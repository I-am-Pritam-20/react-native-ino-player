// ios/RNInoPlayer.mm
#import "RNInoPlayer.h"
#if __has_include("react_native_ino_player-Swift.h")
#  import "react_native_ino_player-Swift.h"
#else
#  import <react_native_ino_player/react_native_ino_player-Swift.h>
#endif

@implementation RNInoPlayer { InoPlayerCore *_core; }
RCT_EXPORT_MODULE(RNInoPlayer)
- (instancetype)init { if (self = [super init]) { _core = [[InoPlayerCore alloc] initWithEmitter:self]; } return self; }
+ (BOOL)requiresMainQueueSetup { return YES; }
- (NSArray<NSString *> *)supportedEvents {
  return @[@"playback-state",@"playback-error",@"playback-active-track-changed",@"playback-queue-ended",@"playback-progress-updated",@"sleep-timer-fired",@"sleep-timer-tick",@"remote-play",@"remote-pause",@"remote-stop",@"remote-next",@"remote-previous",@"remote-seek",@"remote-jump-forward",@"remote-jump-backward",@"remote-shuffle",@"remote-repeat",@"remote-custom-action",@"cast-state-changed",@"car-browse-item-selected"];
}
RCT_EXPORT_METHOD(setupPlayer:(NSDictionary *)options resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core setupPlayerWithOptions:options resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(destroy:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core destroyWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(updateOptions:(NSDictionary *)options resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core updateOptionsWithOptions:options resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(setCustomActions:(NSArray *)actions resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core setCustomActionsWithActions:actions resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(setQueue:(NSArray *)tracks initialIndex:(nonnull NSNumber *)initialIndex resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core setQueueWithTracks:tracks initialIndex:initialIndex.integerValue resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(add:(NSArray *)tracks insertBeforeIndex:(nonnull NSNumber *)insertBeforeIndex resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core addWithTracks:tracks insertBeforeIndex:insertBeforeIndex.integerValue resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(remove:(nonnull NSNumber *)index resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core removeAtIndex:index.integerValue resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(move:(nonnull NSNumber *)fromIndex toIndex:(nonnull NSNumber *)toIndex resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core moveFromIndex:fromIndex.integerValue toIndex:toIndex.integerValue resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(updateMetadataForTrack:(nonnull NSNumber *)index metadata:(NSDictionary *)metadata resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core updateMetadataAtIndex:index.integerValue metadata:metadata resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(clearQueue:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core clearQueueWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(skip:(nonnull NSNumber *)index initialPosition:(nonnull NSNumber *)pos resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core skipToIndex:index.integerValue initialPosition:pos.doubleValue resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(skipToNext:(nonnull NSNumber *)initialPosition resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core skipToNextWithInitialPosition:initialPosition.doubleValue resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(skipToPrevious:(nonnull NSNumber *)initialPosition resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core skipToPreviousWithInitialPosition:initialPosition.doubleValue resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(play:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core playWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(pause:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core pauseWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(stop:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core stopWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(seekTo:(nonnull NSNumber *)position resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core seekToPosition:position.doubleValue resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(seekBy:(nonnull NSNumber *)offset resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core seekByOffset:offset.doubleValue resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(setRate:(nonnull NSNumber *)rate resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core setRate:rate.floatValue resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(setVolume:(nonnull NSNumber *)volume resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core setVolume:volume.floatValue resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(fadeVolumeTo:(nonnull NSNumber *)target durationMs:(nonnull NSNumber *)ms resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core fadeVolumeToTarget:target.floatValue durationMs:ms.doubleValue resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(setRepeatMode:(NSString *)mode resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core setRepeatMode:mode resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(setShuffle:(BOOL)enabled resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core setShuffleEnabled:enabled resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(setSleepTimer:(NSDictionary *)config resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core setSleepTimerWithConfig:config resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(cancelSleepTimer:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core cancelSleepTimerWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(getSleepTimerRemaining:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core getSleepTimerRemainingWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(preloadTrack:(NSString *)url headersJson:(NSString *)headersJson resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core preloadTrackWithUrl:url headersJson:headersJson resolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(clearCache:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core clearCacheWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(getCacheSize:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core getCacheSizeWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(getState:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core getStateWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(getProgress:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core getProgressWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(getRate:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core getRateWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(getVolume:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core getVolumeWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(getRepeatMode:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core getRepeatModeWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(getShuffle:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core getShuffleWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(getQueue:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core getQueueWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(getActiveTrackIndex:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core getActiveTrackIndexWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(getActiveTrack:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core getActiveTrackWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(getCastState:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core getCastStateWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(showAirPlayPicker:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core showAirPlayPickerWithResolve:resolve reject:reject]; }
RCT_EXPORT_METHOD(showCastDialog:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { resolve(nil); }
RCT_EXPORT_METHOD(provideCarBrowseItems:(NSString *)parentId items:(NSArray *)items resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) { [_core provideCarBrowseItemsWithParentId:parentId items:items resolve:resolve reject:reject]; }
@end
