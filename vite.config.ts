import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'
import { crx } from '@crxjs/vite-plugin'

import { chromeManifest } from './manifest'
import { coreBundle } from './plugins/core-bundle'
import genLogPrefix from './plugins/gen-log-prefix'

export default defineConfig({
  plugins: [
    coreBundle({
      inputFilePath: 'src/core/index.ts',
      outputFilePath: 'src/core/output.js',
      functionName: 'coreInject',
      params: '_args',
    }),
    genLogPrefix('__LOG_PREFIX_FILE_PATH__') as any,
    react(),
    crx({
      browser: 'chrome',
      manifest: chromeManifest,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2022',
    modulePreload: false,
    minify: 'esbuild',
    outDir: 'dist',
  },
  server: { port: 3200, hmr: { port: 3200 } },
})
