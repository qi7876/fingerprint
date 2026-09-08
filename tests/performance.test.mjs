import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('background startup and tab injection avoid repeated initialization checks', async () => {
  const [background, script, storage] = await Promise.all([
    readFile(new URL('../src/background/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/background/script.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/background/storage.ts', import.meta.url), 'utf8'),
  ])

  assert.doesNotMatch(background, /void initialize\(\)\s*$/m)
  assert.doesNotMatch(script, /injectScript[\s\S]*ensureFastInject/)
  assert.match(script, /storage\.settings\.fastInject\) return/)
  assert.match(storage, /let storagePromise:/)
})

test('page hooks are gated by the active fingerprint features', async () => {
  const core = await readFile(new URL('../src/core/index.ts', import.meta.url), 'utf8')

  assert.match(core, /if \(needsLocaleHooks && runtime\.window != null\)/)
  assert.match(core, /const stableLanguages = Object\.freeze/)
  assert.match(core, /get: wrap\(languageDescriptor\.get/)
  assert.doesNotMatch(core, /Object\.freeze\(\[\.\.\.languages\]\)[\s\S]*return Object\.freeze/)
})
