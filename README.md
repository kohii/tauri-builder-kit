# tauri-builder-kit

A CLI for building Tauri apps and collecting build artifacts locally. GitHub Releases upload is optional.

## Why this fork

This repository is a fork of `tauri-apps/tauri-action` and was modified to:

- Run as a local CLI instead of a GitHub Action.
- Default to writing artifacts into a specified directory.
- Make GitHub Releases upload optional.

## Install (local repo)

```bash
pnpm build
node dist/index.js --help
```

When published, the CLI entrypoint is `tauri-builder-kit`.

## Usage

Build artifacts externally (e.g. `tauri build`) and then collect them to a directory (default: `./artifacts`):

```bash
tauri-builder-kit --project-path . --output-dir ./artifacts --target x86_64-apple-darwin
```

Upload artifacts to GitHub Releases (optional):

```bash
GITHUB_TOKEN=... \
  tauri-builder-kit \
  --upload-release \
  --owner your-org \
  --repo your-repo \
  --tag-name app-v__VERSION__ \
  --release-name "App v__VERSION__" \
  --release-body "See the assets to download this version and install." \
  --target x86_64-apple-darwin
```

## Key options

- `--output-dir`: Destination directory for artifacts (default: `./artifacts`).
- `--upload-release`: Upload artifacts to GitHub Releases instead of writing to disk.
- `--owner`, `--repo`: Required when uploading to releases.
- `--tag-name`, `--release-name`, `--release-body`: Release metadata. `__VERSION__` is replaced with the app version.
- `--release-id`: Upload to an existing release by ID.
- `--upload-updater-json`: Upload `latest.json` to the release (updater support).
- `--target`: Target triple used to locate artifacts under the target directory.
- `--config`: Cargo build config to locate artifacts.
- `--debug`: Use debug artifacts instead of release artifacts.
- `--profile`: Cargo profile name to locate artifacts.
- `--tauri-script`: (unused) legacy placeholder. This CLI does not invoke the build.
- `--mobile`: `android` or `ios`.
