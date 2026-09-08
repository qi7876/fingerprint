# fingerprint

A small Manifest V3 browser extension for Chrome only.

## Features

- IP Module: aligns the page timezone, browser languages, and `Accept-Language` with the public IP.
- WebRTC: keeps native WebRTC enabled or disables its web-facing APIs completely.
- Fast injection: injects early through Chrome's `userScripts` API, with a compatibility mode fallback.

The IP Module refreshes only when Chrome starts, when the module is enabled, or when the user refreshes it manually.

## Local development and build

Chrome 120+ and Node.js 20.19+ or 22.12+ are required.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run package:chrome
```

The build is written to `dist/`. Enable developer mode at `chrome://extensions`, choose “Load unpacked,” and select that directory.

`npm run package:chrome` performs a clean production build and creates `fingerprint-chrome.zip` in the project root.

Fast injection requires Chrome support and the optional `userScripts` permission.
