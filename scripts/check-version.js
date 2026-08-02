#!/usr/bin/env node
const pkg = require('../package.json');
const tag = process.argv[2];
if (!tag) { console.error('Usage: node scripts/check-version.js <git-tag>'); process.exit(1); }
const tagVersion = tag.replace(/^v/, '');
if (pkg.version !== tagVersion) { console.error(`❌ package.json (${pkg.version}) ≠ tag (${tagVersion})`); process.exit(1); }
console.log(`✅ Version match: ${pkg.version}`);
