import test from 'node:test'
import assert from 'node:assert/strict'

import {
  STORAGE_SCHEMA_VERSION,
  createDefaultSettings,
  formatAcceptLanguage,
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

