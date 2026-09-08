import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('popup exposes every supported setting without a UI framework', async () => {
  const [html, packageJson] = await Promise.all([
    readFile(new URL('../src/popup/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
  ])

  for (const id of [
    'ip-enabled',
    'auto-timezone',
    'auto-languages',
    'webrtc-enabled',
    'fast-inject-enabled',
    'refresh-ip',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`))
  }

  assert.equal(packageJson.dependencies, undefined)
  assert.deepEqual(Object.keys(packageJson.devDependencies).sort(), [
    '@crxjs/vite-plugin',
    '@types/chrome',
    '@types/node',
    'typescript',
    'vite',
  ])
})
