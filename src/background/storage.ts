import { reRequestHeader } from './request'
import { reRegisterScript } from './script'
import { createDefaultSettings, STORAGE_SCHEMA_VERSION } from '@/config'

let cachedStorage: ExtensionStorage | undefined

const defaultStorage = (): ExtensionStorage => ({
  schemaVersion: STORAGE_SCHEMA_VERSION,
  settings: createDefaultSettings(),
})

const isCurrentStorage = (value: Partial<ExtensionStorage>): value is ExtensionStorage => (
  value.schemaVersion === STORAGE_SCHEMA_VERSION && value.settings != null
)

export const initStorage = async (): Promise<ExtensionStorage> => {
  const current = await chrome.storage.local.get() as Partial<ExtensionStorage>

  if (!isCurrentStorage(current)) {
    cachedStorage = defaultStorage()
    await chrome.storage.local.clear()
    await chrome.storage.local.set(cachedStorage)
    return cachedStorage
  }

  cachedStorage = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    settings: { ...createDefaultSettings(), ...current.settings },
    ipInfo: current.ipInfo,
  }
  await chrome.storage.local.set(cachedStorage)
  return cachedStorage
}

export const getStorage = async (): Promise<ExtensionStorage> => (
  cachedStorage ?? initStorage()
)

export const replaceStorage = async (storage: ExtensionStorage): Promise<ExtensionStorage> => {
  cachedStorage = storage
  await chrome.storage.local.set(storage)
  return storage
}

export const updateSettings = async (settings: FingerprintSettings): Promise<ExtensionStorage> => {
  const current = await getStorage()
  const next: ExtensionStorage = {
    ...current,
    settings: { ...createDefaultSettings(), ...settings },
    ipInfo: settings.ipEnabled ? current.ipInfo : undefined,
  }
  await replaceStorage(next)
  await Promise.all([reRegisterScript(), reRequestHeader()])
  return next
}
