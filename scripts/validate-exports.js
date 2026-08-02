#!/usr/bin/env node
const path = require('path');
const REQUIRED = [
  'InoPlayer',
  'State',
  'RepeatMode',
  'CastState',
  'Capability',
  'Event',
  'usePlaybackState',
  'useIsPlaying',
  'useProgress',
  'useActiveTrack',
  'useQueue',
  'useShuffle',
  'useRepeatMode',
  'useSleepTimer',
  'useCastState',
  'useRemoteCustomAction',
  'usePlaybackError',
  'addEventListener',
  'isPlatformSupported',
  'UnsupportedPlatformError',
];
let mod;
try {
  mod = require(path.join(__dirname, '../lib/commonjs/index.js'));
} catch (e) {
  console.error(
    'Could not load lib/commonjs/index.js — run `yarn build` first',e
  );
  process.exit(1);
}
let failed = false;
for (const name of REQUIRED) {
  if (mod[name] === undefined) {
    console.error(`❌ Missing: ${name}`);
    failed = true;
  } else {
    console.log(`${name}`);
  }
}
if (failed) process.exit(1);
else console.log('\n All exports present.');
