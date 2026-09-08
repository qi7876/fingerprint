import { fileURLToPath } from 'node:url'

import { crx } from '@crxjs/vite-plugin'
import { defineConfig } from 'vite'

import { chromeManifest } from './manifest.ts'
import { coreBundle } from './plugins/core-bundle.ts'

const sourceRoot = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  plugins: [
    coreBundle({
      inputFilePath: 'src/core/index.ts',
      outputFilePath: 'src/core/output.js',
      functionName: 'coreInject',
      params: '_args',
    }),
    crx({
      browser: 'chrome',
      manifest: chromeManifest,
    }),
  ],
  resolve: {
    alias: {
      '@': sourceRoot,
    },
  },
  build: {
    target: 'es2022',
    modulePreload: false,
    minify: 'oxc',
    outDir: 'dist',
  },
  server: { port: 3200, hmr: { port: 3200 } },
})
