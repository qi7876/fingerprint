import type { ManifestV3Export } from '@crxjs/vite-plugin'

export const chromeManifest: ManifestV3Export = {
  manifest_version: 3,
  version: '1.0.0',
  name: 'fingerprint',
  description: 'Align timezone and languages with your IP, and control WebRTC.',
  minimum_chrome_version: '120',
  host_permissions: ['<all_urls>'],
  permissions: ['storage', 'tabs', 'scripting', 'declarativeNetRequest'],
  optional_permissions: ['userScripts'],
  icons: { 128: 'logo.png' },
  action: { default_popup: 'src/popup/index.html' },
  background: { service_worker: 'src/background/index.ts' },
}
