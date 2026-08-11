// ObjC++ ViewManager for InoVideoPlayer Fabric component.
 
#import <React/RCTViewManager.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTUIManager.h>
#import <React/RCTLog.h>
 
#if __has_include("react_native_ino_player-Swift.h")
#  import "react_native_ino_player-Swift.h"
#else
#  import <react_native_ino_player/react_native_ino_player-Swift.h>
#endif
 
@interface InoVideoViewManager : RCTViewManager
@end
 
@implementation InoVideoViewManager
 
RCT_EXPORT_MODULE(InoVideoPlayer)
 
+ (BOOL)requiresMainQueueSetup { return YES; }
 
- (UIView *)view {
    return [[InoVideoView alloc] init];
}
 
// ── Props ─────────────────────────────────────────────────────────────────────
 
RCT_EXPORT_VIEW_PROPERTY(onVideoLoad,                   RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVideoLoadStart,              RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVideoProgress,               RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVideoEnd,                    RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVideoError,                  RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVideoBuffer,                 RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVideoSeek,                   RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVideoReadyForDisplay,        RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVideoPlaybackRateChange,     RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVideoVolumeChange,           RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVideoFullscreenChange,       RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVideoPictureInPictureChange, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onVideoAudioBecomingNoisy,     RCTBubblingEventBlock)
 
RCT_CUSTOM_VIEW_PROPERTY(sourceJson, NSString, InoVideoView) {
    [view setSourceJson:json ? [RCTConvert NSString:json] : @""];
}
RCT_CUSTOM_VIEW_PROPERTY(paused, BOOL, InoVideoView) {
    [view setPaused:json ? [RCTConvert BOOL:json] : NO];
}
RCT_CUSTOM_VIEW_PROPERTY(volume, float, InoVideoView) {
    [view setVolume:json ? [RCTConvert float:json] : 1.0f];
}
RCT_CUSTOM_VIEW_PROPERTY(rate, float, InoVideoView) {
    [view setRate:json ? [RCTConvert float:json] : 1.0f];
}
RCT_CUSTOM_VIEW_PROPERTY(muted, BOOL, InoVideoView) {
    [view setMuted:json ? [RCTConvert BOOL:json] : NO];
}
RCT_CUSTOM_VIEW_PROPERTY(repeat, BOOL, InoVideoView) {
    [view setRepeat:json ? [RCTConvert BOOL:json] : NO];
}
RCT_CUSTOM_VIEW_PROPERTY(resizeMode, NSString, InoVideoView) {
    [view setResizeMode:json ? [RCTConvert NSString:json] : @"contain"];
}
RCT_CUSTOM_VIEW_PROPERTY(controls, BOOL, InoVideoView) {
    [view setControls:json ? [RCTConvert BOOL:json] : NO];
}
RCT_CUSTOM_VIEW_PROPERTY(progressInterval, double, InoVideoView) {
    [view setProgressInterval:json ? [RCTConvert double:json] : 250.0];
}
RCT_CUSTOM_VIEW_PROPERTY(drmJson, NSString, InoVideoView) {
    [view setDrmJson:json ? [RCTConvert NSString:json] : @""];
}
RCT_CUSTOM_VIEW_PROPERTY(allowsExternalPlayback, BOOL, InoVideoView) {
    [view setAllowsExternalPlayback:json ? [RCTConvert BOOL:json] : YES];
}
RCT_CUSTOM_VIEW_PROPERTY(fullscreen, BOOL, InoVideoView) {
    [view setFullscreen:json ? [RCTConvert BOOL:json] : NO];
}
RCT_CUSTOM_VIEW_PROPERTY(pictureInPicture, BOOL, InoVideoView) {
    [view setPictureInPicture:json ? [RCTConvert BOOL:json] : NO];
}
RCT_CUSTOM_VIEW_PROPERTY(preventSleep, BOOL, InoVideoView) {
    [view setPreventSleep:json ? [RCTConvert BOOL:json] : NO];
}
 
// textTracksJson / selectedTextTrackJson / selectedAudioTrackJson
// forwarded as-is; parsing handled in Swift
RCT_CUSTOM_VIEW_PROPERTY(textTracksJson, NSString, InoVideoView)         {}
RCT_CUSTOM_VIEW_PROPERTY(selectedTextTrackJson, NSString, InoVideoView)  {}
RCT_CUSTOM_VIEW_PROPERTY(selectedAudioTrackJson, NSString, InoVideoView) {}
 
// ── Commands ──────────────────────────────────────────────────────────────────
 
RCT_EXPORT_METHOD(seek:(nonnull NSNumber *)reactTag
                  time:(double)time
                  toleranceMs:(double)toleranceMs)
{
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary *viewRegistry) {
        InoVideoView *view = viewRegistry[reactTag];
        if (!view || ![view isKindOfClass:[InoVideoView class]]) return;
        [view seek:time toleranceMs:toleranceMs];
    }];
}
 
RCT_EXPORT_METHOD(pause:(nonnull NSNumber *)reactTag) {
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary *viewRegistry) {
        InoVideoView *view = viewRegistry[reactTag];
        [view cmdPause];
    }];
}
 
RCT_EXPORT_METHOD(play:(nonnull NSNumber *)reactTag) {
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary *viewRegistry) {
        InoVideoView *view = viewRegistry[reactTag];
        [view cmdPlay];
    }];
}
 
RCT_EXPORT_METHOD(setVolume:(nonnull NSNumber *)reactTag
                  volume:(float)volume) {
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary *viewRegistry) {
        InoVideoView *view = viewRegistry[reactTag];
        [view cmdSetVolume:volume];
    }];
}
 
RCT_EXPORT_METHOD(setRate:(nonnull NSNumber *)reactTag
                  rate:(float)rate) {
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary *viewRegistry) {
        InoVideoView *view = viewRegistry[reactTag];
        [view cmdSetRate:rate];
    }];
}
 
RCT_EXPORT_METHOD(setMuted:(nonnull NSNumber *)reactTag
                  muted:(BOOL)muted) {
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary *viewRegistry) {
        InoVideoView *view = viewRegistry[reactTag];
        [view cmdSetMuted:muted];
    }];
}
 
RCT_EXPORT_METHOD(enterFullscreen:(nonnull NSNumber *)reactTag) {
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary *viewRegistry) {
        InoVideoView *view = viewRegistry[reactTag];
        [view setFullscreen:YES];
    }];
}
 
RCT_EXPORT_METHOD(exitFullscreen:(nonnull NSNumber *)reactTag) {
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary *viewRegistry) {
        InoVideoView *view = viewRegistry[reactTag];
        [view setFullscreen:NO];
    }];
}
 
RCT_EXPORT_METHOD(enterPiP:(nonnull NSNumber *)reactTag) {
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary *viewRegistry) {
        InoVideoView *view = viewRegistry[reactTag];
        [view setPictureInPicture:YES];
    }];
}
 
RCT_EXPORT_METHOD(exitPiP:(nonnull NSNumber *)reactTag) {
    [self.bridge.uiManager addUIBlock:^(RCTUIManager *uiManager, NSDictionary *viewRegistry) {
        InoVideoView *view = viewRegistry[reactTag];
        [view setPictureInPicture:NO];
    }];
}
 
@end