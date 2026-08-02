// ios/InoPlayerCore.swift
// Full AVFoundation implementation. iOS 13+, iPad, Mac Catalyst.
// AirPlay 1 & 2: automatic via .allowAirPlay session option.

import AVFoundation
import MediaPlayer
import UIKit

@objc public class InoTrack: NSObject {
    @objc public let id: String; @objc public let url: String; @objc public let title: String
    @objc public let artist: String?; @objc public let album: String?; @objc public let artwork: String?
    @objc public let duration: Double; @objc public let contentType: String
    @objc public let localUri: String?; @objc public let type: String?
    @objc public let headers: [String: String]; @objc public let pitchAlgorithm: String?
    @objc public let userInfoJson: String?

    @objc public init(dict: [String: Any]) {
        id = dict["id"] as? String ?? UUID().uuidString; url = dict["url"] as? String ?? ""
        title = dict["title"] as? String ?? "Unknown"; artist = dict["artist"] as? String
        album = dict["album"] as? String; artwork = dict["artwork"] as? String
        duration = dict["duration"] as? Double ?? -1; contentType = dict["contentType"] as? String ?? "audio"
        localUri = dict["localUri"] as? String; type = dict["type"] as? String
        pitchAlgorithm = dict["pitchAlgorithm"] as? String; userInfoJson = dict["userInfoJson"] as? String
        if let h = dict["headers"] as? String, let data = h.data(using: .utf8),
           let p = try? JSONSerialization.jsonObject(with: data) as? [String: String] { headers = p }
        else { headers = [:] }
        super.init()
    }
    @objc public func toDictionary() -> [String: Any] {
        var d: [String: Any] = ["id": id, "url": url, "title": title, "duration": duration, "contentType": contentType]
        if let v = artist { d["artist"] = v }; if let v = album { d["album"] = v }
        if let v = artwork { d["artwork"] = v }; if let v = localUri { d["localUri"] = v }
        if let v = type { d["type"] = v }; if let v = pitchAlgorithm { d["pitchAlgorithm"] = v }
        if let v = userInfoJson { d["userInfoJson"] = v }
        if !headers.isEmpty, let data = try? JSONSerialization.data(withJSONObject: headers), let s = String(data: data, encoding: .utf8) { d["headers"] = s }
        return d
    }
    func makePlayerItem() -> AVPlayerItem {
        let uri = URL(string: localUri ?? url)!
        var opts: [String: Any] = [:]
        if !headers.isEmpty { opts["AVURLAssetHTTPHeaderFieldsKey"] = headers }
        let asset = opts.isEmpty ? AVURLAsset(url: uri) : AVURLAsset(url: uri, options: opts)
        let item = AVPlayerItem(asset: asset)
        item.audioTimePitchAlgorithm = pitchAlgorithm == "voice" ? .varispeed : pitchAlgorithm == "linear" ? .lowQualityZeroLatency : .spectral
        return item
    }
}

private enum RepeatMode: String { case off = "off"; case track = "track"; case trackOnce = "track-once"; case queue = "queue" }
private struct CustomActionDef { let id: String; let title: String; let icon: String; let showIn: String }

@objc public class InoPlayerCore: NSObject {
    private weak var emitter: RCTEventEmitter?
    @objc public init(emitter: RCTEventEmitter) { self.emitter = emitter; super.init() }

    private var player: AVQueuePlayer?; private var timeObserver: Any?
    private var rateObs: NSKeyValueObservation?; private var statusObs: NSKeyValueObservation?
    private var itemObs: NSKeyValueObservation?; private var endObs: NSObjectProtocol?
    private var routeObs: NSObjectProtocol?; private var interruptObs: NSObjectProtocol?
    private var progressInterval: TimeInterval = 1.0; private var handleNoisy = true
    private var queue: [InoTrack] = []; private var currentIndex = 0; private var preloadWindow = 3
    private var repeatMode: RepeatMode = .off; private var shuffleEnabled = false
    private var shuffledOrder: [Int] = []; private var trackOnceFired = false
    private var sleepTimer: Timer?; private var sleepRemaining: TimeInterval = -1
    private var sleepFadeOut = true; private var sleepFadeDuration: TimeInterval = 10; private var sleepEndOfTrack = false
    private var fadeTimer: Timer?; private var customActions: [CustomActionDef] = []
    private var capabilities: [String] = []; private var jumpFwd: TimeInterval = 30; private var jumpBwd: TimeInterval = 15
    private var carBrowsePending: [String: [[String: Any]]] = [:]

    // MARK: - Setup
    @objc public func setupPlayer(withOptions options: [String: Any], resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            do {
                let cat = options["iosAudioCategory"] as? String ?? "playback"
                let avCat: AVAudioSession.Category = cat == "ambient" ? .ambient : cat == "soloAmbient" ? .soloAmbient : .playback
                let modeStr = options["iosAudioMode"] as? String ?? "default"
                let avMode: AVAudioSession.Mode = modeStr == "moviePlayback" ? .moviePlayback : modeStr == "spokenAudio" ? .spokenAudio : modeStr == "voiceChat" ? .voiceChat : .default
                try AVAudioSession.sharedInstance().setCategory(avCat, mode: avMode, options: [.allowAirPlay, .allowBluetooth, .allowBluetoothA2DP])
                try AVAudioSession.sharedInstance().setActive(true)
                self.progressInterval = options["progressUpdateEventInterval"] as? TimeInterval ?? 1.0
                self.preloadWindow = options["preloadWindowSize"] as? Int ?? 3
                self.jumpFwd = options["jumpForwardInterval"] as? TimeInterval ?? 30
                self.jumpBwd = options["jumpBackwardInterval"] as? TimeInterval ?? 15
                self.handleNoisy = options["handleAudioBecomingNoisy"] as? Bool ?? true
                self.setupRemoteControls(); self.setupSessionObservers(); resolve(true)
            } catch { reject("SETUP_ERROR", error.localizedDescription, error) }
        }
    }
    @objc public func destroy(withResolve resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) { DispatchQueue.main.async { [weak self] in self?.teardown(); resolve(nil) } }
    private func teardown() { sleepTimer?.invalidate(); fadeTimer?.invalidate(); removeObservers(); removeSessionObservers(); player?.pause(); player = nil; queue = []; currentIndex = 0; MPNowPlayingInfoCenter.default().nowPlayingInfo = nil; UIApplication.shared.endReceivingRemoteControlEvents() }

    private func setupSessionObservers() {
        interruptObs = NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] n in
            guard let self, let info = n.userInfo, let typeVal = info[AVAudioSessionInterruptionTypeKey] as? UInt, let type = AVAudioSession.InterruptionType(rawValue: typeVal) else { return }
            if type == .began { self.player?.pause(); self.emitState("paused") }
            else if type == .ended { if let opts = info[AVAudioSessionInterruptionOptionKey] as? UInt, AVAudioSession.InterruptionOptions(rawValue: opts).contains(.shouldResume) { try? AVAudioSession.sharedInstance().setActive(true); self.player?.play() } }
        }
        routeObs = NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] n in
            guard let self, let info = n.userInfo, let reasonVal = info[AVAudioSessionRouteChangeReasonKey] as? UInt, let reason = AVAudioSession.RouteChangeReason(rawValue: reasonVal) else { return }
            if reason == .oldDeviceUnavailable && self.handleNoisy { self.player?.pause() }
            let route = AVAudioSession.sharedInstance().currentRoute; let isAP = route.outputs.contains { $0.portType == .airPlay }
            self.emit("cast-state-changed", body: ["state": isAP ? "connected" : "not_connected", "deviceName": route.outputs.first?.portName as Any])
        }
    }
    private func removeSessionObservers() { [interruptObs, routeObs].compactMap { $0 }.forEach { NotificationCenter.default.removeObserver($0) }; interruptObs = nil; routeObs = nil }

    // MARK: - Options
    @objc public func updateOptions(withOptions options: [String: Any], resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        if let i = options["progressUpdateEventInterval"] as? TimeInterval { progressInterval = i; resetProgressObs() }
        if let f = options["jumpForwardInterval"] as? TimeInterval { jumpFwd = f }
        if let b = options["jumpBackwardInterval"] as? TimeInterval { jumpBwd = b }
        if let c = options["capabilitiesJson"] as? String, let data = c.data(using: .utf8), let arr = try? JSONSerialization.jsonObject(with: data) as? [String] { capabilities = arr }
        if let a = options["customActionsJson"] as? String { parseActionsJson(a) }
        setupRemoteControls(); resolve(nil)
    }
    @objc public func setCustomActions(withActions actions: [[String: Any]], resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        customActions = actions.compactMap { d in guard let id = d["id"] as? String, let icon = d["icon"] as? String else { return nil }; return CustomActionDef(id: id, title: d["title"] as? String ?? "", icon: icon, showIn: d["showIn"] as? String ?? "both") }
        resolve(nil)
    }
    private func parseActionsJson(_ json: String) { guard let data = json.data(using: .utf8), let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return }; customActions = arr.compactMap { d in guard let id = d["id"] as? String, let icon = d["icon"] as? String else { return nil }; return CustomActionDef(id: id, title: d["title"] as? String ?? "", icon: icon, showIn: d["showIn"] as? String ?? "both") } }

    // MARK: - Queue
    @objc public func setQueue(withTracks tracks: [[String: Any]], initialIndex: Int, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        DispatchQueue.main.async { [weak self] in guard let self else { return }; self.queue = tracks.map { InoTrack(dict: $0) }; self.currentIndex = max(0, min(initialIndex, self.queue.count - 1)); self.rebuildPlayer(); resolve(nil) }
    }
    @objc public func add(withTracks tracks: [[String: Any]], insertBeforeIndex: Int, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        DispatchQueue.main.async { [weak self] in guard let self else { return }; let newTracks = tracks.map { InoTrack(dict: $0) }; let at = insertBeforeIndex < 0 ? self.queue.count : min(insertBeforeIndex, self.queue.count); self.queue.insert(contentsOf: newTracks, at: at); if at > self.currentIndex, let p = self.player { newTracks.map { $0.makePlayerItem() }.forEach { p.insert($0, after: p.items().last) } } else { self.rebuildPlayer() }; resolve(nil) }
    }
    @objc public func remove(atIndex index: Int, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { DispatchQueue.main.async { [weak self] in guard let self, index < self.queue.count else { resolve(nil); return }; self.queue.remove(at: index); if index == self.currentIndex { self.rebuildPlayer() } else if index < self.currentIndex { self.currentIndex -= 1 }; resolve(nil) } }
    @objc public func move(fromIndex: Int, toIndex: Int, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { DispatchQueue.main.async { [weak self] in guard let self, fromIndex < self.queue.count, toIndex < self.queue.count else { resolve(nil); return }; let t = self.queue.remove(at: fromIndex); self.queue.insert(t, at: toIndex); self.rebuildPlayer(); resolve(nil) } }
    @objc public func updateMetadata(atIndex index: Int, metadata: [String: Any], resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { guard index < queue.count else { resolve(nil); return }; var m = queue[index].toDictionary(); metadata.forEach { m[$0.key] = $0.value }; queue[index] = InoTrack(dict: m); if index == currentIndex { updateNowPlaying() }; resolve(nil) }
    @objc public func clearQueue(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { DispatchQueue.main.async { [weak self] in guard let self else { return }; self.player?.pause(); self.player?.removeAllItems(); self.queue = []; self.currentIndex = 0; self.cancelSleepInternal(); resolve(nil) } }

    // MARK: - Navigation
    @objc public func skip(toIndex index: Int, initialPosition: Double, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { DispatchQueue.main.async { [weak self] in guard let self, index < self.queue.count else { resolve(nil); return }; self.currentIndex = index; self.rebuildPlayer(); if initialPosition > 0 { self.player?.seek(to: CMTime(seconds: initialPosition, preferredTimescale: 1000)) }; resolve(nil) } }
    @objc public func skipToNext(withInitialPosition pos: Double, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { DispatchQueue.main.async { [weak self] in guard let self else { return }; if let next = self.nextIndex() { self.currentIndex = next; self.rebuildPlayer(); if pos > 0 { self.player?.seek(to: CMTime(seconds: pos, preferredTimescale: 1000)) } }; resolve(nil) } }
    @objc public func skipToPrevious(withInitialPosition pos: Double, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { DispatchQueue.main.async { [weak self] in guard let self else { return }; if (self.player?.currentTime().seconds ?? 0) > 3 && pos == 0 { self.player?.seek(to: .zero) } else if let prev = self.previousIndex() { self.currentIndex = prev; self.rebuildPlayer() }; resolve(nil) } }

    // MARK: - Transport
    @objc public func play(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { DispatchQueue.main.async { [weak self] in guard let self else { return }; if self.player == nil && !self.queue.isEmpty { self.rebuildPlayer() }; try? AVAudioSession.sharedInstance().setActive(true); self.player?.play(); resolve(nil) } }
    @objc public func pause(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { player?.pause(); resolve(nil) }
    @objc public func stop(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { player?.pause(); player?.seek(to: .zero); resolve(nil) }
    @objc public func seekTo(position: Double, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { player?.seek(to: CMTime(seconds: position, preferredTimescale: 1000), toleranceBefore: .zero, toleranceAfter: .zero) { _ in resolve(nil) } }
    @objc public func seekBy(offset: Double, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { guard let p = player else { resolve(nil); return }; let cur = p.currentTime().seconds; let dur = p.currentItem?.duration.seconds ?? 0; p.seek(to: CMTime(seconds: max(0, min(cur + offset, dur > 0 ? dur : .greatestFiniteMagnitude)), preferredTimescale: 1000)); resolve(nil) }
    @objc public func setRate(_ rate: Float, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { player?.rate = rate; resolve(nil) }
    @objc public func setVolume(_ vol: Float, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { fadeTimer?.invalidate(); fadeTimer = nil; player?.volume = max(0, min(1, vol)); resolve(nil) }
    @objc public func fadeVolumeTo(target: Float, durationMs: Double, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        guard let p = player else { resolve(nil); return }; fadeTimer?.invalidate()
        let start = p.volume; let delta = target - start; let steps = max(1, Int(durationMs / 50)); var step = 0
        fadeTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak p] timer in step += 1; p?.volume = max(0, min(1, start + delta * Float(step) / Float(steps))); if step >= steps { p?.volume = max(0, min(1, target)); timer.invalidate() } }
        resolve(nil)
    }

    // MARK: - Mode
    @objc public func setRepeatMode(_ mode: String, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { repeatMode = RepeatMode(rawValue: mode) ?? .off; trackOnceFired = false; player?.actionAtItemEnd = (repeatMode == .track || repeatMode == .trackOnce) ? .none : .advance; resolve(nil) }
    @objc public func setShuffle(enabled: Bool, resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { shuffleEnabled = enabled; if enabled { buildShuffleOrder() }; resolve(nil) }
    private func buildShuffleOrder() { shuffledOrder = Array(0..<queue.count).shuffled(); if let p = shuffledOrder.firstIndex(of: currentIndex) { shuffledOrder.swapAt(0, p) } }
    private func playOrder() -> [Int] { if shuffleEnabled { if shuffledOrder.count != queue.count { buildShuffleOrder() }; return shuffledOrder }; return Array(0..<queue.count) }
    private func nextIndex() -> Int? { let o = playOrder(); guard let p = o.firstIndex(of: currentIndex) else { return nil }; let n = p + 1; if n < o.count { return o[n] }; return repeatMode == .queue ? o.first : nil }
    private func previousIndex() -> Int? { let o = playOrder(); guard let p = o.firstIndex(of: currentIndex) else { return nil }; let pr = p - 1; if pr >= 0 { return o[pr] }; return repeatMode == .queue ? o.last : nil }

    // MARK: - Sleep timer
    @objc public func setSleepTimer(withConfig config: [String: Any], resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        cancelSleepInternal(); sleepFadeOut = config["fadeOut"] as? Bool ?? true; sleepFadeDuration = config["fadeDuration"] as? TimeInterval ?? 10; sleepEndOfTrack = (config["mode"] as? String ?? "countdown") == "end-of-track"
        if sleepEndOfTrack { sleepRemaining = -2 } else { sleepRemaining = config["duration"] as? TimeInterval ?? 0; guard sleepRemaining > 0 else { resolve(nil); return }; sleepTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in guard let self else { return }; self.sleepRemaining -= 1; self.emit("sleep-timer-tick", body: ["remaining": self.sleepRemaining]); if self.sleepRemaining <= 0 { self.fireSleepTimer() } } }
        resolve(nil)
    }
    @objc public func cancelSleepTimer(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { cancelSleepInternal(); resolve(nil) }
    @objc public func getSleepTimerRemaining(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { resolve(sleepRemaining) }
    private func cancelSleepInternal() { sleepTimer?.invalidate(); sleepTimer = nil; sleepRemaining = -1; sleepEndOfTrack = false }
    private func fireSleepTimer() {
        sleepTimer?.invalidate(); sleepTimer = nil; sleepRemaining = -1; sleepEndOfTrack = false
        if sleepFadeOut { let dur = sleepFadeDuration; fadeVolumeTo(target: 0, durationMs: dur * 1000, resolve: { _ in }, reject: { _, _, _ in }); DispatchQueue.main.asyncAfter(deadline: .now() + dur) { [weak self] in self?.player?.pause(); self?.player?.volume = 1; self?.emit("sleep-timer-fired", body: nil) } }
        else { player?.pause(); emit("sleep-timer-fired", body: nil) }
    }

    // MARK: - Cache
    @objc public func preloadTrack(withUrl url: String, headersJson: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
        guard let u = URL(string: url) else { resolve(nil); return }; var headers: [String: String] = [:]; if let data = headersJson.data(using: .utf8), let p = try? JSONSerialization.jsonObject(with: data) as? [String: String] { headers = p }
        var req = URLRequest(url: u); headers.forEach { req.addValue($0.value, forHTTPHeaderField: $0.key) }; URLSession.shared.dataTask(with: req) { _, _, _ in resolve(nil) }.resume()
    }
    @objc public func clearCache(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { URLCache.shared.removeAllCachedResponses(); resolve(nil) }
    @objc public func getCacheSize(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { resolve(URLCache.shared.currentDiskUsage) }

    // MARK: - Getters
    @objc public func getState(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { resolve(currentStateString()) }
    @objc public func getProgress(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        guard let p = player else { resolve(["position": 0, "duration": 0, "buffered": 0]); return }
        let pos = p.currentTime().seconds; let dur = p.currentItem?.duration.seconds ?? 0
        let buf = p.currentItem?.loadedTimeRanges.compactMap { $0.timeRangeValue }.filter { CMTimeRangeContainsTime($0, time: p.currentTime()) }.map { CMTimeGetSeconds(CMTimeRangeGetEnd($0)) }.max() ?? 0
        resolve(["position": max(0, pos.isNaN ? 0 : pos), "duration": max(0, dur.isNaN ? 0 : dur), "buffered": max(0, buf)])
    }
    @objc public func getRate(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { resolve(player?.rate ?? 1.0) }
    @objc public func getVolume(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { resolve(player?.volume ?? 1.0) }
    @objc public func getRepeatMode(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { resolve(repeatMode.rawValue) }
    @objc public func getShuffle(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { resolve(shuffleEnabled) }
    @objc public func getQueue(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { resolve(queue.map { $0.toDictionary() }) }
    @objc public func getActiveTrackIndex(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { resolve(queue.isEmpty ? -1 : currentIndex) }
    @objc public func getActiveTrack(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { guard !queue.isEmpty, currentIndex < queue.count else { resolve(nil); return }; resolve(queue[currentIndex].toDictionary()) }
    @objc public func getCastState(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { let route = AVAudioSession.sharedInstance().currentRoute; let isAP = route.outputs.contains { $0.portType == .airPlay }; resolve(["state": isAP ? "connected" : "not_connected", "deviceName": route.outputs.first?.portName as Any]) }
    @objc public func showAirPlayPicker(withResolve resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            if #available(iOS 14.0, *) { let picker = AVRoutePickerView(frame: .zero); picker.subviews.compactMap { $0 as? UIButton }.first?.sendActions(for: .touchUpInside) }
            else { let v = MPVolumeView(); v.showsVolumeSlider = false; v.subviews.compactMap { $0 as? UIButton }.first?.sendActions(for: .touchUpInside) }
            resolve(nil)
        }
    }
    @objc public func provideCarBrowseItems(withParentId parentId: String, items: [[String: Any]], resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) { carBrowsePending[parentId] = items; resolve(nil) }

    // MARK: - AVQueuePlayer
    private func rebuildPlayer() {
        removeObservers(); player?.pause(); player = nil; guard !queue.isEmpty else { return }
        currentIndex = max(0, min(currentIndex, queue.count - 1))
        let order = playOrder(); guard let startPos = order.firstIndex(of: currentIndex) else { return }
        let p = AVQueuePlayer(items: order[startPos...].map { queue[$0].makePlayerItem() })
        p.volume = 1.0; p.actionAtItemEnd = (repeatMode == .track || repeatMode == .trackOnce) ? .none : .advance
        player = p; attachObservers(to: p); preloadUpcoming(); updateNowPlaying()
    }
    private func preloadUpcoming() {
        let order = playOrder(); guard let pos = order.firstIndex(of: currentIndex) else { return }
        for i in 1...preloadWindow { let n = pos + i; guard n < order.count else { break }; _ = queue[order[n]].makePlayerItem() }
    }
    private func attachObservers(to p: AVQueuePlayer) {
        let iv = CMTime(seconds: progressInterval, preferredTimescale: 1000)
        timeObserver = p.addPeriodicTimeObserver(forInterval: iv, queue: .main) { [weak self] time in guard let self, let item = self.player?.currentItem else { return }; let dur = item.duration.seconds; let buf = item.loadedTimeRanges.compactMap { $0.timeRangeValue }.map { CMTimeGetSeconds(CMTimeRangeGetEnd($0)) }.max() ?? 0; self.emit("playback-progress-updated", body: ["position": time.seconds, "duration": max(0, dur.isNaN ? 0 : dur), "buffered": buf, "track": self.currentIndex]) }
        rateObs = p.observe(\.rate, options: [.new]) { [weak self] _, _ in self?.emitStateChange() }
        statusObs = p.observe(\.status, options: [.new]) { [weak self] _, _ in self?.emitStateChange() }
        itemObs = p.observe(\.currentItem, options: [.new]) { [weak self] _, _ in self?.handleItemTransition() }
        endObs = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: nil, queue: .main) { [weak self] n in self?.handleItemEnded(notification: n) }
    }
    private func removeObservers() { if let o = timeObserver { player?.removeTimeObserver(o); timeObserver = nil }; rateObs?.invalidate(); statusObs?.invalidate(); itemObs?.invalidate(); rateObs = nil; statusObs = nil; itemObs = nil; if let o = endObs { NotificationCenter.default.removeObserver(o); endObs = nil } }
    private func resetProgressObs() { guard let p = player else { return }; if let o = timeObserver { p.removeTimeObserver(o); timeObserver = nil }; let iv = CMTime(seconds: progressInterval, preferredTimescale: 1000); timeObserver = p.addPeriodicTimeObserver(forInterval: iv, queue: .main) { [weak self] time in guard let self, let item = self.player?.currentItem else { return }; let dur = item.duration.seconds; self.emit("playback-progress-updated", body: ["position": time.seconds, "duration": max(0, dur.isNaN ? 0 : dur), "buffered": 0, "track": self.currentIndex]) } }
    private func handleItemTransition() { updateNowPlaying(); emitActiveTrackChanged(); preloadUpcoming() }
    private func handleItemEnded(notification: Notification) {
        if sleepEndOfTrack || sleepRemaining == -2 { sleepRemaining = -1; sleepEndOfTrack = false; fireSleepTimer(); return }
        switch repeatMode {
        case .track: player?.seek(to: .zero); player?.play()
        case .trackOnce: if !trackOnceFired { trackOnceFired = true; player?.seek(to: .zero); player?.play() } else { trackOnceFired = false; repeatMode = .off; player?.actionAtItemEnd = .advance; if let next = nextIndex() { currentIndex = next; rebuildPlayer(); player?.play() } else { emitState("ended"); emit("playback-queue-ended", body: ["index": currentIndex, "position": 0]) } }
        case .off: if currentIndex == queue.count - 1 { emitState("ended"); emit("playback-queue-ended", body: ["index": currentIndex, "position": player?.currentTime().seconds ?? 0]) } else { currentIndex += 1; updateNowPlaying(); emitActiveTrackChanged() }
        case .queue: currentIndex = (currentIndex + 1) % queue.count; if currentIndex == 0 { rebuildPlayer(); player?.play() } else { updateNowPlaying(); emitActiveTrackChanged() }
        }
    }
    private func updateNowPlaying() {
        guard currentIndex < queue.count else { return }; let t = queue[currentIndex]
        var info: [String: Any] = [MPMediaItemPropertyTitle: t.title, MPMediaItemPropertyArtist: t.artist ?? "", MPMediaItemPropertyAlbumTitle: t.album ?? "", MPNowPlayingInfoPropertyPlaybackRate: player?.rate ?? 0, MPNowPlayingInfoPropertyElapsedPlaybackTime: player?.currentTime().seconds ?? 0]
        if t.duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = t.duration }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        if let artStr = t.artwork, let artURL = URL(string: artStr) { URLSession.shared.dataTask(with: artURL) { data, _, _ in guard let data, let img = UIImage(data: data) else { return }; DispatchQueue.main.async { var u = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? info; u[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: img.size) { _ in img }; MPNowPlayingInfoCenter.default().nowPlayingInfo = u } }.resume() }
    }
    private func setupRemoteControls() {
        UIApplication.shared.beginReceivingRemoteControlEvents(); let cc = MPRemoteCommandCenter.shared()
        [cc.playCommand, cc.pauseCommand, cc.stopCommand, cc.nextTrackCommand, cc.previousTrackCommand, cc.changePlaybackPositionCommand, cc.skipForwardCommand, cc.skipBackwardCommand, cc.togglePlayPauseCommand, cc.changeShuffleModeCommand, cc.changeRepeatModeCommand].forEach { $0.removeTarget(nil) }
        cc.playCommand.addTarget { [weak self] _ in self?.emit("remote-play", body: nil); return .success }
        cc.pauseCommand.addTarget { [weak self] _ in self?.emit("remote-pause", body: nil); return .success }
        cc.stopCommand.addTarget { [weak self] _ in self?.emit("remote-stop", body: nil); return .success }
        cc.togglePlayPauseCommand.addTarget { [weak self] _ in if self?.player?.rate == 0 { self?.emit("remote-play", body: nil) } else { self?.emit("remote-pause", body: nil) }; return .success }
        cc.nextTrackCommand.addTarget { [weak self] _ in self?.emit("remote-next", body: nil); return .success }
        cc.previousTrackCommand.addTarget { [weak self] _ in self?.emit("remote-previous", body: nil); return .success }
        cc.changePlaybackPositionCommand.isEnabled = capabilities.contains("seekTo")
        cc.changePlaybackPositionCommand.addTarget { [weak self] event in guard let e = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }; self?.emit("remote-seek", body: ["position": e.positionTime]); return .success }
        cc.skipForwardCommand.preferredIntervals = [NSNumber(value: jumpFwd)]; cc.skipBackwardCommand.preferredIntervals = [NSNumber(value: jumpBwd)]
        cc.skipForwardCommand.isEnabled = capabilities.contains("jumpForward"); cc.skipBackwardCommand.isEnabled = capabilities.contains("jumpBackward")
        cc.skipForwardCommand.addTarget { [weak self] event in guard let e = event as? MPSkipIntervalCommandEvent else { return .commandFailed }; self?.emit("remote-jump-forward", body: ["interval": e.interval]); return .success }
        cc.skipBackwardCommand.addTarget { [weak self] event in guard let e = event as? MPSkipIntervalCommandEvent else { return .commandFailed }; self?.emit("remote-jump-backward", body: ["interval": e.interval]); return .success }
        if capabilities.contains("shuffle") { cc.changeShuffleModeCommand.isEnabled = true; cc.changeShuffleModeCommand.addTarget { [weak self] _ in self?.emit("remote-shuffle", body: nil); return .success } }
        if capabilities.contains("repeat") { cc.changeRepeatModeCommand.isEnabled = true; cc.changeRepeatModeCommand.addTarget { [weak self] _ in self?.emit("remote-repeat", body: nil); return .success } }
    }
    private func currentStateString() -> String { guard let p = player else { return "none" }; if p.status == .failed || p.currentItem?.status == .failed { return "error" }; if p.currentItem?.isPlaybackBufferEmpty == true { return "buffering" }; if p.rate != 0 { return "playing" }; return "paused" }
    private func emitStateChange() { emitState(currentStateString()) }
    private func emitState(_ s: String) { emit("playback-state", body: ["state": s]) }
    private func emitActiveTrackChanged() { var body: [String: Any] = ["index": currentIndex, "lastIndex": -1, "lastPosition": 0]; if currentIndex < queue.count { body["track"] = queue[currentIndex].toDictionary() }; emit("playback-active-track-changed", body: body); updateNowPlaying() }
    private func emit(_ name: String, body: [String: Any]?) { DispatchQueue.main.async { [weak self] in self?.emitter?.sendEvent(withName: name, body: body) } }
}
