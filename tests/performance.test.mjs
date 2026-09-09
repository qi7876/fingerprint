import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'

import { transformWithOxc } from 'vite'

const coreUrl = new URL('../src/core/index.ts', import.meta.url)

const createCoreContext = async (config) => {
  const source = await readFile(coreUrl, 'utf8')
  const { code } = await transformWithOxc(source, coreUrl.pathname, { lang: 'ts' })
  const context = createContext({ _args: { config } })
  runInContext(`
    class Navigator {
      get language() {
        if (!(this instanceof Navigator)) throw new TypeError('Illegal invocation')
        return 'en-US'
      }
      get languages() {
        if (!(this instanceof Navigator)) throw new TypeError('Illegal invocation')
        return Object.freeze(['en-US', 'en'])
      }
    }
    globalThis.Navigator = Navigator
    globalThis.navigator = new Navigator()
    globalThis.window = globalThis
    globalThis.RTCPeerConnection = function RTCPeerConnection() {}
    globalThis.webkitRTCPeerConnection = function webkitRTCPeerConnection() {}
    globalThis.MediaStreamTrack = function MediaStreamTrack() {}
    globalThis.navigator.mediaDevices = {}
    globalThis.navigator.getUserMedia = function getUserMedia() {}
    globalThis.__native = {
      Date,
      functionToString: Function.prototype.toString,
      getFullYear: Date.prototype.getFullYear,
      dateToString: Date.prototype.toString,
      mediaDevices: navigator.mediaDevices,
      getUserMedia: navigator.getUserMedia,
      MediaStreamTrack,
    }
  `, context)
  runInContext(code, context)
  return context
}

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

test('page injection avoids invasive browser API hooks', async () => {
  const core = await readFile(new URL('../src/core/index.ts', import.meta.url), 'utf8')

  assert.match(core, /const stableLanguages = Object\.freeze/)
  assert.match(core, /get: wrap\(languageDescriptor\.get/)
  assert.doesNotMatch(core, /MutationObserver|createObjectURL|SharedWorker|Function\.prototype\.toString/)
})

test('timezone injection preserves invalid Date and native local Date methods', async () => {
  const context = await createCoreContext({
    disableWebRtc: false,
    languages: ['en-US', 'en'],
    timezone: 'America/New_York',
  })
  const result = runInContext(`(() => {
    const invalid = new Date(NaN)
    const invalidMethods = [
      'toString', 'toDateString', 'toTimeString', 'toLocaleString',
      'getFullYear', 'getMonth', 'getDate', 'getDay',
      'getHours', 'getMinutes', 'getSeconds', 'getTimezoneOffset',
    ]
    return {
      invalid: Object.fromEntries(invalidMethods.map((name) => {
        try { return [name, String(invalid[name]())] }
        catch (error) { return [name, error.name + ': ' + error.message] }
      })),
      nativeDate: Date === __native.Date,
      nativeGetFullYear: Date.prototype.getFullYear === __native.getFullYear,
      nativeToString: Date.prototype.toString === __native.dateToString,
      nativeFunctionToString: Function.prototype.toString === __native.functionToString,
      timezone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset: new Date('2024-01-15T12:00:00Z').getTimezoneOffset(),
      stableLanguages: navigator.languages === navigator.languages,
      illegalLanguageReceiver: (() => {
        try {
          Object.getOwnPropertyDescriptor(Navigator.prototype, 'language').get.call({})
          return 'accepted'
        } catch (error) {
          return error.name
        }
      })(),
      nullOptions: (() => {
        try {
          new Intl.DateTimeFormat(undefined, null)
          return 'accepted'
        } catch (error) {
          return error.name
        }
      })(),
      constructorIdentity: Intl.DateTimeFormat.prototype.constructor === Intl.DateTimeFormat,
      ignoresUnknownOption: (() => {
        const options = {}
        Object.defineProperty(options, 'unexpected', {
          enumerable: true,
          get() { throw new Error('unexpected option was read') },
        })
        try {
          new Intl.DateTimeFormat('en-US', options)
          return true
        } catch {
          return false
        }
      })(),
    }
  })()`, context)

  assert.deepEqual({ ...result.invalid }, {
    toString: 'Invalid Date',
    toDateString: 'Invalid Date',
    toTimeString: 'Invalid Date',
    toLocaleString: 'Invalid Date',
    getFullYear: 'NaN',
    getMonth: 'NaN',
    getDate: 'NaN',
    getDay: 'NaN',
    getHours: 'NaN',
    getMinutes: 'NaN',
    getSeconds: 'NaN',
    getTimezoneOffset: 'NaN',
  })
  assert.equal(result.nativeDate, true)
  assert.equal(result.nativeGetFullYear, true)
  assert.equal(result.nativeToString, true)
  assert.equal(result.nativeFunctionToString, true)
  assert.equal(result.timezone, 'America/New_York')
  assert.equal(result.offset, 300)
  assert.equal(result.stableLanguages, true)
  assert.equal(result.illegalLanguageReceiver, 'TypeError')
  assert.equal(result.nullOptions, 'TypeError')
  assert.equal(result.constructorIdentity, true)
  assert.equal(result.ignoresUnknownOption, true)
})

test('a blocked language patch does not prevent timezone injection', async () => {
  const source = await readFile(coreUrl, 'utf8')
  const { code } = await transformWithOxc(source, coreUrl.pathname, { lang: 'ts' })
  const context = createContext({
    _args: {
      config: {
        disableWebRtc: false,
        languages: ['en-US', 'en'],
        timezone: 'America/New_York',
      },
    },
  })
  runInContext(`
    class Navigator {
      get language() { return 'native' }
      get languages() { return ['native'] }
    }
    globalThis.Navigator = Navigator
    globalThis.navigator = new Navigator()
    Object.freeze(Navigator.prototype)
  `, context)

  assert.doesNotThrow(() => runInContext(code, context))
  assert.equal(
    runInContext('new Intl.DateTimeFormat().resolvedOptions().timeZone', context),
    'America/New_York',
  )
})

test('disabling WebRTC keeps ordinary media APIs available', async () => {
  const context = await createCoreContext({ disableWebRtc: true })
  const result = runInContext(`({
    peerConnection: typeof RTCPeerConnection,
    prefixedPeerConnection: typeof webkitRTCPeerConnection,
    mediaDevices: navigator.mediaDevices === __native.mediaDevices,
    getUserMedia: navigator.getUserMedia === __native.getUserMedia,
    mediaStreamTrack: MediaStreamTrack === __native.MediaStreamTrack,
  })`, context)

  assert.equal(result.peerConnection, 'undefined')
  assert.equal(result.prefixedPeerConnection, 'undefined')
  assert.equal(result.mediaDevices, true)
  assert.equal(result.getUserMedia, true)
  assert.equal(result.mediaStreamTrack, true)
})
