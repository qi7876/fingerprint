# fingerprint

A small Manifest V3 browser extension for Chrome only.

## Features

- IP Module: aligns the page timezone, browser languages, and `Accept-Language` with the public IP.
- WebRTC: keeps native WebRTC enabled or disables its web-facing APIs completely.
- Fast injection: injects early through Chrome's `userScripts` API, with a compatibility mode fallback.

The IP Module refreshes only when Chrome starts, when the module is enabled, or when the user refreshes it manually.

## Local development and build

Chrome 120+, Node.js 24.21.0 LTS, and pnpm 12.8.1 are required. The Node.js version is pinned in `.nvmrc` (run `nvm install` and `nvm use` if you use nvm), and the pnpm version is pinned in `package.json`.

If pnpm is not installed, install it using [pnpm's installation guide](https://pnpm.io/installation). With Corepack installed, run `corepack enable pnpm` to use the project's pinned version.

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run build
pnpm run package:chrome
```

The build is written to `dist/`. Enable developer mode at `chrome://extensions`, choose “Load unpacked,” and select that directory.

`pnpm run package:chrome` performs a clean production build and creates `fingerprint-chrome.zip` in the project root.

Fast injection requires Chrome support and the optional `userScripts` permission.
