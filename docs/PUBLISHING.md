# Publishing to npm — Step-by-Step

## Part 1 — One-time setup

### 1. Create GitHub repo
- Go to https://github.com/new
- Name: `react-native-ino-player`, Public, no README init
- Push:
```bash
git init && git add . && git commit -m "chore: initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/react-native-ino-player.git
git push -u origin main && git checkout -b develop && git push -u origin develop
```

### 2. Replace YOUR_USERNAME
```bash
find . -not -path '*/node_modules/*' -not -path '*/.git/*' -type f \
  \( -name '*.json' -o -name '*.md' -o -name '*.ts' \) \
  -exec sed -i '' 's/YOUR_USERNAME/your-github-name/g' {} +
git add -A && git commit -m "chore: set repo URLs" && git push
```

### 3. npm token
- npmjs.com → Access Tokens → Granular Access Token → Read+Write
- GitHub repo → Settings → Secrets → Actions → `NPM_TOKEN`

### 4. Branch protection (Settings → Branches)
- Protect `main` and `develop`: require PR + status checks (CI, Android, iOS, Web, Windows)

## Part 2 — First publish

```bash
yarn install && yarn build && yarn test
npm pack --dry-run          # verify contents
npm login
npm publish --access public
```

## Part 3 — Automated releases (every release after first)

```bash
# Patch: 1.0.0 → 1.0.1
yarn release --patch

# Minor: 1.0.0 → 1.1.0
yarn release --minor

# Pre-release
yarn release --preRelease=beta
```

`release-it` bumps `package.json`, updates `CHANGELOG.md`, commits, tags, pushes.
`publish.yml` GitHub Action then: runs CI → builds → verifies version → `npm publish --provenance` → creates GitHub Release.

## Part 4 — Secrets summary

| Secret | Source | Used by |
|---|---|---|
| `NPM_TOKEN` | npmjs.com → Access Tokens | `publish.yml` |
| `CODECOV_TOKEN` | codecov.io | `ci.yml` |

## Part 5 — Pre-release checklist

- [ ] All CI checks pass on `main`
- [ ] `CHANGELOG.md` updated
- [ ] `package.json` version matches the tag you will create
- [ ] Tested on real device: Android + iOS + Web + Windows
- [ ] `npm pack --dry-run` output looks correct
