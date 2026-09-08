import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  transformWithOxc,
  type Plugin,
  type ResolvedConfig,
  type ViteDevServer,
} from 'vite'

type CoreBundleOptions = {
  inputFilePath: string
  outputFilePath: string
  functionName: string
  params: string
}

export const coreBundle = (options: CoreBundleOptions): Plugin => {
  let inputPath = ''
  let outputPath = ''

  const bundle = async (): Promise<void> => {
    const source = readFileSync(inputPath, 'utf8')
    const result = await transformWithOxc(source, inputPath, { lang: 'ts' })
    const output = `export function ${options.functionName}(${options.params}) {\n${result.code}\n}\n`

    let current = ''
    try {
      current = readFileSync(outputPath, 'utf8')
    } catch {
      // The generated output does not exist on the first build.
    }
    if (current !== output) writeFileSync(outputPath, output)
  }

  return {
    name: 'core-bundle',
    async configResolved(config: ResolvedConfig) {
      inputPath = resolve(config.root, options.inputFilePath)
      outputPath = resolve(config.root, options.outputFilePath)
      await bundle()
    },
    configureServer(server: ViteDevServer) {
      server.watcher.add(inputPath)
      server.watcher.on('change', (changedPath) => {
        if (resolve(changedPath) !== inputPath) return
        void bundle().then(() => {
          server.ws.send({ type: 'full-reload' })
        })
      })
    },
  }
}

export default coreBundle
