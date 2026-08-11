/**
 * example/src/App.tsx
 * Demo app — works on Android, iOS, Web, and Windows.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';

import InoPlayer, {
  Capability,
  Event,
  CastState,
  isPlatformSupported,
  usePlaybackState,
  useIsPlaying,
  useProgress,
  useActiveTrack,
  useQueue,
  useShuffle,
  useRepeatMode,
  useSleepTimer,
  useCastState,
  useRemoteCustomAction,
  usePlaybackError,
  addEventListener,
  State,
  RepeatMode,
} from 'react-native-ino-player';

const TRACKS = [
  {
    id: '1',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    title: 'Song One',
    artist: 'SoundHelix',
    artwork: 'https://picsum.photos/seed/1/300/300',
    duration: 372,
  },
  {
    id: '2',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    title: 'Song Two',
    artist: 'SoundHelix',
    artwork: 'https://picsum.photos/seed/2/300/300',
    duration: 311,
  },
  {
    id: '3',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    title: 'Song Three',
    artist: 'SoundHelix',
    artwork: 'https://picsum.photos/seed/3/300/300',
    duration: 282,
  },
];

async function setup() {
  await InoPlayer.setupPlayer({
    maxCacheSize: 256 * 1024 * 1024,
    preloadWindowSize: 2,
    backgroundAudio: true,
    handleAudioBecomingNoisy: true,
    android: { wakeMode: 'network' },
    ios: { audioCategory: 'playback' },
  });
  await InoPlayer.updateOptions({
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
      Capability.Shuffle,
      Capability.Repeat,
      Capability.JumpForward,
      Capability.JumpBackward,
    ],
    compactCapabilities: [
      Capability.Play,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
    ],
    progressUpdateEventInterval: 1,
    jumpForwardInterval: 30,
    jumpBackwardInterval: 15,
    customActions: [
      {
        id: 'bookmark',
        title: 'Bookmark',
        icon: 'ic_bookmark',
        showIn: 'both',
      },
    ],
  });
  await InoPlayer.setQueue(TRACKS, 0);
  InoPlayer.setCarBrowseTreeLoader(async (parentId) => {
    if (parentId === null)
      return TRACKS.map((t) => ({
        id: t.id,
        title: t.title,
        subtitle: t.artist,
        artworkUri: t.artwork,
        playable: true,
        browsable: false,
      }));
    return [];
  });
}

export default function App() {
  const [ready, setReady] = useState(false);
  const { state } = usePlaybackState();
  const { playing, bufferingDuringPlay } = useIsPlaying();
  const { position, duration, buffered } = useProgress(500);
  const track = useActiveTrack();
  const queue = useQueue();
  const { shuffle, toggleShuffle } = useShuffle();
  const { repeatMode, cycleRepeatMode } = useRepeatMode();
  const {
    remaining,
    active: timerActive,
    cancel: cancelTimer,
  } = useSleepTimer();
  const { state: castState, deviceName } = useCastState();
  const error = usePlaybackError();

  useRemoteCustomAction(
    'bookmark',
    useCallback(() => {
      Alert.alert(
        'Bookmarked',
        `"${track?.title}" at ${Math.floor(position)}s`
      );
    }, [track, position])
  );

  useEffect(() => {
    if (!isPlatformSupported()) {
      console.warn('InoPlayer: unsupported platform');
      return;
    }
    setup()
      .then(() => setReady(true))
      .catch((e) => console.error('Setup failed:', e));
    const sub = addEventListener(Event.PlaybackQueueEnded, () =>
      console.log('Queue ended')
    );
    return () => {
      sub.remove();
      InoPlayer.destroy().catch(() => {});
    };
  }, []);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const pct = duration > 0 ? (position / duration) * 100 : 0;
  const repeatLabel = {
    [RepeatMode.Off]: '🔁 Off',
    [RepeatMode.Track]: '🔂 Track',
    [RepeatMode.TrackOnce]: '🔂 Once',
    [RepeatMode.Queue]: '🔁 Queue',
  }[repeatMode];
  const castLabel =
    castState === CastState.Connected
      ? `📡 ${deviceName ?? 'Device'}`
      : '📡 Cast';

  if (!isPlatformSupported())
    return (
      <View style={styles.center}>
        <Text style={styles.warn}>
          InoPlayer is not supported on "{Platform.OS}". Use Android, iOS, Web,
          or Windows.
        </Text>
      </View>
    );
  if (!ready)
    return (
      <View style={styles.center}>
        <Text style={styles.label}>Setting up…</Text>
      </View>
    );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Track info */}
        <View style={styles.card}>
          <Text style={styles.title}>{track?.title ?? 'No track'}</Text>
          <Text style={styles.sub}>
            {track?.artist ?? ''}
            {track?.album ? ` — ${track.album}` : ''}
          </Text>
          <Text
            style={[
              styles.sub,
              { color: state === State.Error ? '#f44' : '#4c4' },
            ]}
          >
            {state}
            {bufferingDuringPlay ? ' (buffering)' : ''}
          </Text>
          {error && (
            <Text style={{ color: '#f44', fontSize: 12 }}>{error.message}</Text>
          )}
        </View>

        {/* Progress */}
        <View style={styles.card}>
          <View style={styles.bar}>
            <View
              style={[
                styles.barBuf,
                { width: `${(buffered / (duration || 1)) * 100}%` },
              ]}
            />
            <View style={[styles.barPos, { width: `${pct}%` }]} />
          </View>
          <View style={styles.row}>
            <Text style={styles.mono}>{fmt(position)}</Text>
            <Text style={styles.mono}>{fmt(duration)}</Text>
          </View>
        </View>

        {/* Transport */}
        <View style={[styles.card, styles.row]}>
          <Btn label="⏮" onPress={() => InoPlayer.skipToPrevious()} />
          <Btn label="−15s" onPress={() => InoPlayer.skipBackward(15)} />
          <Btn
            label={playing ? '⏸' : '▶'}
            big
            onPress={() => (playing ? InoPlayer.pause() : InoPlayer.play())}
          />
          <Btn label="+30s" onPress={() => InoPlayer.skipForward(30)} />
          <Btn label="⏭" onPress={() => InoPlayer.skipToNext()} />
        </View>

        {/* Mode */}
        <View style={[styles.card, styles.row]}>
          <Btn
            label={shuffle ? '🔀 On' : '🔀 Off'}
            onPress={toggleShuffle}
            active={shuffle}
          />
          <Btn label={repeatLabel} onPress={cycleRepeatMode} />
        </View>

        {/* Speed */}
        <View style={styles.card}>
          <Text style={styles.label}>Speed</Text>
          <View style={styles.row}>
            {[0.5, 1.0, 1.5, 2.0].map((r) => (
              <Btn
                key={r}
                label={`${r}×`}
                small
                onPress={() => InoPlayer.setRate(r)}
              />
            ))}
          </View>
        </View>

        {/* Volume */}
        <View style={styles.card}>
          <Text style={styles.label}>Volume</Text>
          <View style={styles.row}>
            <Btn
              label="Fade↓"
              small
              onPress={() => InoPlayer.fadeVolumeTo(0, 3000)}
            />
            <Btn
              label="Fade↑"
              small
              onPress={() => InoPlayer.fadeVolumeTo(1, 3000)}
            />
            <Btn label="🔇" small onPress={() => InoPlayer.setVolume(0)} />
            <Btn label="🔊" small onPress={() => InoPlayer.setVolume(1)} />
          </View>
        </View>

        {/* Sleep timer */}
        <View style={styles.card}>
          <Text style={styles.label}>Sleep Timer</Text>
          <View style={styles.row}>
            <Btn
              label="5 min"
              small
              onPress={() =>
                InoPlayer.setSleepTimer({
                  duration: 300,
                  fadeOut: true,
                  fadeDuration: 10,
                })
              }
            />
            <Btn
              label="End of track"
              small
              onPress={() => InoPlayer.setSleepTimer({ mode: 'end-of-track' })}
            />
            {timerActive && (
              <Btn
                label={`Cancel (${Math.ceil(remaining)}s)`}
                small
                onPress={cancelTimer}
              />
            )}
          </View>
        </View>

        {/* Cast */}
        <View style={[styles.card, styles.row]}>
          <Btn
            label={castLabel}
            onPress={() =>
              Platform.OS === 'ios'
                ? InoPlayer.showAirPlayPicker()
                : InoPlayer.showCastDialog()
            }
          />
        </View>

        {/* Cache info */}
        <View style={styles.card}>
          <Btn
            label="Clear Cache"
            small
            onPress={async () => {
              await InoPlayer.clearCache();
              Alert.alert('Cache cleared');
            }}
          />
        </View>

        {/* Queue */}
        <View style={styles.card}>
          <Text style={styles.label}>Queue ({queue.length})</Text>
          {queue.map((t, i) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => InoPlayer.skip(i)}
              style={[styles.qRow, t.id === track?.id && styles.qActive]}
            >
              <Text style={styles.qText}>
                {i + 1}. {t.title}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.row}>
            <Btn
              label="Add"
              small
              onPress={() =>
                InoPlayer.add({
                  id: String(Date.now()),
                  url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
                  title: 'Song Four',
                  artist: 'SoundHelix',
                })
              }
            />
            <Btn label="Clear" small onPress={() => InoPlayer.clearQueue()} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Btn({
  label,
  onPress,
  big,
  small,
  active,
}: {
  label: string;
  onPress: () => void;
  big?: boolean;
  small?: boolean;
  active?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.btn,
        big && styles.btnBig,
        small && styles.btnSm,
        active && styles.btnOn,
      ]}
    >
      <Text style={[styles.btnTxt, big && { fontSize: 22 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f0f' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
  },
  scroll: { padding: 16, gap: 10 },
  card: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 14, gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  sub: { fontSize: 13, color: '#888' },
  label: { fontSize: 13, color: '#aaa', fontWeight: '600' },
  warn: { color: '#f80', fontSize: 14, textAlign: 'center', padding: 20 },
  mono: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barBuf: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#555',
    borderRadius: 2,
  },
  barPos: { height: '100%', backgroundColor: '#1db954', borderRadius: 2 },
  btn: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  btnBig: {
    backgroundColor: '#1db954',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  btnSm: { paddingHorizontal: 8, paddingVertical: 6 },
  btnOn: { backgroundColor: '#1db954' },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  qRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  qActive: {
    backgroundColor: '#1a2a1a',
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  qText: { color: '#ccc', fontSize: 13 },
});
