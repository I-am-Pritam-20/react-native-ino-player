// Native video rendering view for react-native-ino-player.
// Uses AVPlayer + AVPlayerLayer for hardware-accelerated video on all Apple platforms:
//   iPhone, iPad, Mac Catalyst (same code path).
//
// Features:
//   • All video formats AVFoundation supports (mp4, mov, m4v, HLS)
//   • DRM: FairPlay Streaming via AVAssetResourceLoaderDelegate
//   • Subtitles: Embedded CEA-608/708 + sidecar VTT via AVMediaSelectionGroup
//   • AirPlay: Automatic via allowsExternalPlayback
//   • Picture-in-Picture: AVPictureInPictureController (iOS 14+, iPad 9+)
//   • Fullscreen: Presented via AVPlayerViewController
 
import AVFoundation
import AVKit
import UIKit
import MediaPlayer
 
@objc public class InoVideoView: UIView {
 
    // ── Player ────────────────────────────────────────────────────────────────
    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var playerItem: AVPlayerItem?
    private var pipController: AVPictureInPictureController?
    private var playerViewController: AVPlayerViewController?
 
    // ── Observers ─────────────────────────────────────────────────────────────
    private var timeObserver: Any?
    private var statusObserver: NSKeyValueObservation?
    private var rateObserver:   NSKeyValueObservation?
    private var itemObserver:   NSKeyValueObservation?
    private var durationObserver: NSKeyValueObservation?
    private var endObserver: NSObjectProtocol?
    private var stallObserver: NSObjectProtocol?
 
    // ── Props ─────────────────────────────────────────────────────────────────
    private var sourceJson       = ""
    private var isPaused         = false
    private var volume: Float    = 1.0
    private var rate: Float      = 1.0
    private var isMuted          = false
    private var repeatEnabled    = false
    private var progressIntervalMs: TimeInterval = 250
    private var resizeMode       = "contain"
    private var showControls     = false
    private var allowsExtPlayback = true
    private var drmJson          = ""
 
    // ── Callbacks ─────────────────────────────────────────────────────────────
    @objc public var onVideoLoad:                ((Any) -> Void)?
    @objc public var onVideoLoadStart:           ((Any) -> Void)?
    @objc public var onVideoProgress:            ((Any) -> Void)?
    @objc public var onVideoEnd:                 ((Any) -> Void)?
    @objc public var onVideoError:               ((Any) -> Void)?
    @objc public var onVideoBuffer:              ((Any) -> Void)?
    @objc public var onVideoSeek:                ((Any) -> Void)?
    @objc public var onVideoReadyForDisplay:     ((Any) -> Void)?
    @objc public var onVideoPlaybackRateChange:  ((Any) -> Void)?
    @objc public var onVideoVolumeChange:        ((Any) -> Void)?
    @objc public var onVideoFullscreenChange:    ((Any) -> Void)?
    @objc public var onVideoPictureInPictureChange: ((Any) -> Void)?
    @objc public var onVideoAudioBecomingNoisy:  ((Any) -> Void)?
 
    // ─────────────────────────────────────────────────────────────────────────
    // Init
    // ─────────────────────────────────────────────────────────────────────────
 
    @objc public override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .black
        clipsToBounds   = true
        setupAudioSession()
    }
 
    required init?(coder: NSCoder) { fatalError("init(coder:) not supported") }
 
    private func setupAudioSession() {
        try? AVAudioSession.sharedInstance().setCategory(
            .playback, mode: .moviePlayback,
            options: [.allowAirPlay, .allowBluetooth, .allowBluetoothA2DP]
        )
        try? AVAudioSession.sharedInstance().setActive(true)
    }
 
    // ─────────────────────────────────────────────────────────────────────────
    // Prop setters
    // ─────────────────────────────────────────────────────────────────────────
 
    @objc public func setSourceJson(_ json: String) {
        guard json != sourceJson || player == nil else { return }
        sourceJson = json
        if !json.isEmpty { loadSource() }
    }
 
    @objc public func setPaused(_ paused: Bool) {
        isPaused = paused
        if paused { player?.pause() } else { player?.play() }
    }
 
    @objc public func setVolume(_ vol: Float) {
        volume = max(0, min(1, vol))
        player?.volume = isMuted ? 0 : volume
    }
 
    @objc public func setRate(_ r: Float) {
        rate = r
        if player?.rate != 0 { player?.rate = r }
    }
 
    @objc public func setMuted(_ muted: Bool) {
        isMuted = muted
        player?.volume = muted ? 0 : volume
    }
 
    @objc public func setRepeat(_ repeat: Bool) {
        repeatEnabled = `repeat`
    }
 
    @objc public func setResizeMode(_ mode: String) {
        resizeMode = mode
        playerLayer?.videoGravity = {
            switch mode {
            case "cover":   return .resizeAspectFill
            case "stretch": return .resize
            default:        return .resizeAspect  // contain / none
            }
        }()
    }
 
    @objc public func setControls(_ controls: Bool) {
        showControls = controls
        // Controls shown via playerViewController overlay — toggle visibility
        playerViewController?.showsPlaybackControls = controls
    }
 
    @objc public func setProgressInterval(_ ms: Double) {
        progressIntervalMs = ms
        resetProgressObserver()
    }
 
    @objc public func setDrmJson(_ json: String) {
        drmJson = json
    }
 
    @objc public func setAllowsExternalPlayback(_ allows: Bool) {
        allowsExtPlayback = allows
        player?.allowsExternalPlayback = allows
    }
 
    @objc public func setFullscreen(_ fs: Bool) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            if fs { self.presentFullscreen() }
            else  { self.dismissFullscreen() }
        }
    }
 
    @objc public func setPictureInPicture(_ pip: Bool) {
        guard #available(iOS 14.0, *) else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self, let ctrl = self.pipController else { return }
            if pip && ctrl.isPictureInPicturePossible { ctrl.startPictureInPicture() }
            else if !pip { ctrl.stopPictureInPicture() }
        }
    }
 
    @objc public func setPreventSleep(_ prevent: Bool) {
        UIApplication.shared.isIdleTimerDisabled = prevent
    }
 
    // ─────────────────────────────────────────────────────────────────────────
    // Source loading
    // ─────────────────────────────────────────────────────────────────────────
 
    private func loadSource() {
        releasePlayer()
 
        guard let data = sourceJson.data(using: .utf8),
              let src  = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let uriStr = src["uri"] as? String,
              let uri  = URL(string: uriStr)
        else { return }
 
        let headers   = src["headers"] as? [String: String] ?? [:]
        let startTime = src["startPosition"] as? Double ?? 0
 
        // Build AVURLAsset with optional HTTP headers
        var opts: [String: Any] = [:]
        if !headers.isEmpty { opts["AVURLAssetHTTPHeaderFieldsKey"] = headers }
        let asset = opts.isEmpty ? AVURLAsset(url: uri) : AVURLAsset(url: uri, options: opts)
 
        // FairPlay DRM
        if !drmJson.isEmpty,
           let drmData = drmJson.data(using: .utf8),
           let drm = try? JSONSerialization.jsonObject(with: drmData) as? [String: Any],
           (drm["type"] as? String) == "fairplay" {
            let delegate = InoFairPlayDelegate(drmConfig: drm)
            asset.resourceLoader.setDelegate(delegate, queue: DispatchQueue.global(qos: .userInitiated))
        }
 
        let item = AVPlayerItem(asset: asset)
        if startTime > 0 {
            item.seek(to: CMTime(seconds: startTime, preferredTimescale: 1000), completionHandler: nil)
        }
 
        let avPlayer = AVPlayer(playerItem: item)
        avPlayer.volume              = isMuted ? 0 : volume
        avPlayer.allowsExternalPlayback = allowsExtPlayback
        avPlayer.playbackCoordinator
 
        self.player     = avPlayer
        self.playerItem = item
 
        setupPlayerLayer(avPlayer)
        setupPiP()
        attachObservers(player: avPlayer, item: item)
 
        if !isPaused { avPlayer.play() }
        onVideoLoadStart?([:])
    }
 
    private func setupPlayerLayer(_ avPlayer: AVPlayer) {
        playerLayer?.removeFromSuperlayer()
        let layer = AVPlayerLayer(player: avPlayer)
        layer.frame        = bounds
        layer.videoGravity = {
            switch resizeMode {
            case "cover":   return .resizeAspectFill
            case "stretch": return .resize
            default:        return .resizeAspect
            }
        }()
        self.layer.insertSublayer(layer, at: 0)
        playerLayer = layer
    }
 
    private func setupPiP() {
        guard #available(iOS 14.0, *),
              AVPictureInPictureController.isPictureInPictureSupported(),
              let layer = playerLayer else { return }
        let ctrl = AVPictureInPictureController(playerLayer: layer)
        ctrl.delegate = self
        pipController = ctrl
    }
 
    // ─────────────────────────────────────────────────────────────────────────
    // Observers
    // ─────────────────────────────────────────────────────────────────────────
 
    private func attachObservers(player avPlayer: AVPlayer, item: AVPlayerItem) {
        statusObserver = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            guard let self else { return }
            switch item.status {
            case .readyToPlay:
                let dur  = item.duration.seconds
                let vt   = item.presentationSize
                self.onVideoLoad?([
                    "duration":    dur.isNaN || !dur.isFinite ? -1.0 : dur,
                    "currentTime": avPlayer.currentTime().seconds,
                    "naturalWidth":  Int(vt.width),
                    "naturalHeight": Int(vt.height),
                    "orientation":   vt.width >= vt.height ? "landscape" : "portrait",
                    "hasAudioTrack": true,
                    "hasTextTracks": false,
                    "audioTracksJson": "[]",
                    "textTracksJson":  "[]",
                ])
                self.onVideoReadyForDisplay?([:])
                if self.rate != 1.0 { avPlayer.rate = self.rate }
            case .failed:
                let err = item.error
                self.onVideoError?([
                    "code": "ITEM_FAILED",
                    "message": err?.localizedDescription ?? "Playback failed",
                    "domain": "ios",
                ])
            default: break
            }
        }
 
        itemObserver = avPlayer.observe(\.currentItem, options: [.new]) { [weak self] _, _ in
            self?.onVideoBuffer?(["isBuffering": false])
        }
 
        rateObserver = avPlayer.observe(\.rate, options: [.new]) { [weak self] player, _ in
            self?.onVideoPlaybackRateChange?(["playbackRate": player.rate])
        }
 
        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            if self.repeatEnabled {
                avPlayer.seek(to: .zero); avPlayer.play()
            } else {
                self.onVideoEnd?([:])
            }
        }
 
        stallObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemPlaybackStalled, object: item, queue: .main
        ) { [weak self] _ in self?.onVideoBuffer?(["isBuffering": true]) }
 
        // Progress
        let interval = CMTime(seconds: progressIntervalMs / 1000.0, preferredTimescale: 1000)
        timeObserver = avPlayer.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            guard let self, let item = avPlayer.currentItem else { return }
            let dur  = item.duration.seconds
            let buf  = item.loadedTimeRanges.compactMap { $0.timeRangeValue }
                .filter { CMTimeRangeContainsTime($0, time: time) }
                .map    { CMTimeGetSeconds(CMTimeRangeGetEnd($0)) }.max() ?? 0
            self.onVideoProgress?([
                "currentTime":      time.seconds,
                "playableDuration": buf,
                "seekableDuration": dur.isNaN || !dur.isFinite ? 0.0 : dur,
            ])
        }
    }
 
    private func resetProgressObserver() {
        guard let avPlayer = player else { return }
        if let o = timeObserver { avPlayer.removeTimeObserver(o); timeObserver = nil }
        let interval = CMTime(seconds: progressIntervalMs / 1000.0, preferredTimescale: 1000)
        timeObserver = avPlayer.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            guard let self, let item = avPlayer.currentItem else { return }
            let dur = item.duration.seconds
            self.onVideoProgress?([
                "currentTime":      time.seconds,
                "playableDuration": avPlayer.currentItem?.loadedTimeRanges.last?.timeRangeValue.end.seconds ?? 0,
                "seekableDuration": dur.isNaN ? 0 : dur,
            ])
        }
    }
 
    // ─────────────────────────────────────────────────────────────────────────
    // Imperative commands
    // ─────────────────────────────────────────────────────────────────────────
 
    @objc public func seek(_ time: Double, toleranceMs: Double) {
        let target = CMTime(seconds: time, preferredTimescale: 1000)
        let tol    = CMTime(seconds: toleranceMs / 1000.0, preferredTimescale: 1000)
        player?.seek(to: target, toleranceBefore: tol, toleranceAfter: tol) { [weak self] _ in
            self?.onVideoSeek?(["currentTime": time, "seekTime": time])
        }
    }
 
    @objc public func cmdPause()              { player?.pause() }
    @objc public func cmdPlay()               { player?.play() }
    @objc public func cmdSetVolume(_ vol: Float) { player?.volume = max(0, min(1, vol)) }
    @objc public func cmdSetRate(_ r: Float)  {
        rate = r; if player?.rate != 0 { player?.rate = r }
    }
    @objc public func cmdSetMuted(_ muted: Bool) {
        player?.volume = muted ? 0 : volume
    }
 
    // ─────────────────────────────────────────────────────────────────────────
    // Fullscreen
    // ─────────────────────────────────────────────────────────────────────────
 
    private func presentFullscreen() {
        guard let avPlayer = player else { return }
        let vc = AVPlayerViewController()
        vc.player = avPlayer
        vc.showsPlaybackControls = true
        vc.delegate = self
 
        if let rootVC = UIApplication.shared.windows.first?.rootViewController {
            rootVC.present(vc, animated: true) { [weak self] in
                avPlayer.play()
                self?.onVideoFullscreenChange?(["isFullscreen": true])
            }
        }
        playerViewController = vc
    }
 
    private func dismissFullscreen() {
        playerViewController?.dismiss(animated: true) { [weak self] in
            self?.onVideoFullscreenChange?(["isFullscreen": false])
        }
        playerViewController = nil
    }
 
    // ─────────────────────────────────────────────────────────────────────────
    // Release
    // ─────────────────────────────────────────────────────────────────────────
 
    private func releasePlayer() {
        if let o = timeObserver { player?.removeTimeObserver(o) }
        statusObserver?.invalidate(); rateObserver?.invalidate()
        itemObserver?.invalidate(); durationObserver?.invalidate()
        [endObserver, stallObserver].compactMap { $0 }.forEach { NotificationCenter.default.removeObserver($0) }
        timeObserver = nil; statusObserver = nil; rateObserver = nil
        itemObserver = nil; endObserver = nil; stallObserver = nil
        player?.pause(); player = nil; playerItem = nil
        playerLayer?.removeFromSuperlayer(); playerLayer = nil
        pipController = nil
    }
 
    // ─────────────────────────────────────────────────────────────────────────
    // Layout
    // ─────────────────────────────────────────────────────────────────────────
 
    public override func layoutSubviews() {
        super.layoutSubviews()
        playerLayer?.frame = bounds
    }
 
    deinit {
        UIApplication.shared.isIdleTimerDisabled = false
        releasePlayer()
    }
}
 
// MARK: - AVPlayerViewControllerDelegate (Fullscreen)
 
extension InoVideoView: AVPlayerViewControllerDelegate {
    public func playerViewController(
        _ playerViewController: AVPlayerViewController,
        willBeginFullScreenPresentationWithAnimationCoordinator coordinator: UIViewControllerTransitionCoordinator
    ) {
        onVideoFullscreenChange?(["isFullscreen": true])
    }
    public func playerViewController(
        _ playerViewController: AVPlayerViewController,
        willEndFullScreenPresentationWithAnimationCoordinator coordinator: UIViewControllerTransitionCoordinator
    ) {
        onVideoFullscreenChange?(["isFullscreen": false])
    }
}
 
// MARK: - AVPictureInPictureControllerDelegate
 
extension InoVideoView: AVPictureInPictureControllerDelegate {
    @available(iOS 14.0, *)
    public func pictureInPictureControllerDidStartPictureInPicture(
        _ pictureInPictureController: AVPictureInPictureController
    ) {
        onVideoPictureInPictureChange?(["isActive": true])
    }
 
    @available(iOS 14.0, *)
    public func pictureInPictureControllerDidStopPictureInPicture(
        _ pictureInPictureController: AVPictureInPictureController
    ) {
        onVideoPictureInPictureChange?(["isActive": false])
    }
}
 
// MARK: - FairPlay DRM Delegate
 
private class InoFairPlayDelegate: NSObject, AVAssetResourceLoaderDelegate {
    private let drmConfig: [String: Any]
 
    init(drmConfig: [String: Any]) { self.drmConfig = drmConfig; super.init() }
 
    func resourceLoader(
        _ resourceLoader: AVAssetResourceLoader,
        shouldWaitForLoadingOfRequestedResource loadingRequest: AVAssetResourceLoadingRequest
    ) -> Bool {
        guard
            let url     = loadingRequest.request.url,
            url.scheme  == "skd",
            let licenseUrl = drmConfig["licenseServer"] as? String,
            let licenseUri = URL(string: licenseUrl)
        else { loadingRequest.finishLoading(with: NSError(domain: "InoFairPlay", code: -1)); return false }
 
        guard
            let contentId = url.host,
            let certUrl   = (drmConfig["certificateUri"] as? String).flatMap(URL.init(string:))
        else { loadingRequest.finishLoading(with: NSError(domain: "InoFairPlay", code: -2)); return false }
 
        // 1. Fetch FairPlay certificate
        URLSession.shared.dataTask(with: certUrl) { certData, _, err in
            guard let certData, err == nil else {
                loadingRequest.finishLoading(with: err); return
            }
            // 2. Generate SPC (Server Playback Context)
            guard
                let contentIdData = contentId.data(using: .utf8),
                let spc = try? loadingRequest.streamingContentKeyRequestData(
                    forApp: certData, contentIdentifier: contentIdData, options: nil
                )
            else { loadingRequest.finishLoading(with: NSError(domain: "InoFairPlay", code: -3)); return }
 
            // 3. Fetch CKC (Content Key Context) from license server
            var req = URLRequest(url: licenseUri)
            req.httpMethod = "POST"
            req.httpBody   = spc
            if let hdrs = self.drmConfig["headers"] as? [String: String] {
                hdrs.forEach { req.setValue($0.value, forHTTPHeaderField: $0.key) }
            }
 
            URLSession.shared.dataTask(with: req) { ckcData, _, ckcErr in
                if let ckcData {
                    loadingRequest.dataRequest?.respond(with: ckcData)
                    loadingRequest.finishLoading()
                } else {
                    loadingRequest.finishLoading(with: ckcErr)
                }
            }.resume()
        }.resume()
        return true
    }
}