import test from 'node:test'
import assert from 'node:assert/strict'

import {
  STORAGE_SCHEMA_VERSION,
  createDefaultSettings,
  createInjectionConfig,
  formatAcceptLanguage,
  injectionConfigsEqual,
} from '../src/config.ts'

test('the new schema starts with only the three supported feature groups', () => {
  assert.equal(STORAGE_SCHEMA_VERSION, 1)
  assert.deepEqual(createDefaultSettings(), {
    ipEnabled: false,
    autoTimezone: true,
    autoLanguages: true,
    webrtcEnabled: true,
    fastInject: false,
  })
})

test('Accept-Language uses descending quality values with a safe floor', () => {
  assert.equal(formatAcceptLanguage([]), '')
  assert.equal(formatAcceptLanguage(['zh-CN', 'zh', 'en-US']), 'zh-CN,zh;q=0.9,en-US;q=0.8')
  assert.match(
    formatAcceptLanguage(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']),
    /l;q=0\.1$/,
  )
})

test('injection config contains only active page overrides', () => {
  const storage = {
    schemaVersion: 1,
    settings: {
      ...createDefaultSettings(),
      ipEnabled: true,
    },
    ipInfo: {
      ip: '203.0.113.1',
      countryCode: 'US',
      timezone: 'America/New_York',
      languages: ['en-US', 'en'],
      updatedAt: 1,
    },
  }
  const config = createInjectionConfig(storage)

  assert.deepEqual(config, {
    disableWebRtc: false,
    languages: ['en-US', 'en'],
    timezone: 'America/New_York',
  })
  assert.equal(injectionConfigsEqual(config, { ...config }), true)
  assert.equal(injectionConfigsEqual(config, { ...config, timezone: 'UTC' }), false)
})
