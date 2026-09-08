import {
  createDefaultSettings,
  createInjectionConfig,
  injectionConfigsEqual,
  STORAGE_SCHEMA_VERSION,
} from '@/config'
import { requestHeaderValue, syncRequestHeader } from './request'
import { syncRegisteredScript } from './script'

let cachedStorage: ExtensionStorage | undefined
let storagePromise: Promise<ExtensionStorage> | undefined

const defaultStorage = (): ExtensionStorage => ({
  schemaVersion: STORAGE_SCHEMA_VERSION,
  settings: createDefaultSettings(),
})

const isCurrentStorage = (value: Partial<ExtensionStorage>): value is ExtensionStorage => (
  value.schemaVersion === STORAGE_SCHEMA_VERSION && value.settings != null
)

const loadStorage = async (): Promise<ExtensionStorage> => {
  const current = await chrome.storage.local.get() as Partial<ExtensionStorage>

  if (!isCurrentStorage(current)) {
    const storage = defaultStorage()
    await chrome.storage.local.clear()
    await chrome.storage.local.set(storage)
    return storage
  }

  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    settings: { ...createDefaultSettings(), ...current.settings },
    ipInfo: current.ipInfo,
  }
}

export const initStorage = (): Promise<ExtensionStorage> => {
  if (cachedStorage != null) return Promise.resolve(cachedStorage)
  if (storagePromise != null) return storagePromise

  storagePromise = loadStorage()
    .then((storage) => {
      cachedStorage = storage
      return storage
    })
    .catch((error: unknown) => {
      storagePromise = undefined
      throw error
    })
  return storagePromise
}

export const getStorage = (): Promise<ExtensionStorage> => initStorage()

export const replaceStorage = async (storage: ExtensionStorage): Promise<ExtensionStorage> => {
  cachedStorage = storage
  storagePromise = Promise.resolve(storage)
  await chrome.storage.local.set(storage)
  return storage
}

const settingsEqual = (left: FingerprintSettings, right: FingerprintSettings): boolean => (
  left.ipEnabled === right.ipEnabled
  && left.autoTimezone === right.autoTimezone
  && left.autoLanguages === right.autoLanguages
  && left.webrtcEnabled === right.webrtcEnabled
  && left.fastInject === right.fastInject
)

const synchronizeEffects = async (
  previous: ExtensionStorage | undefined,
  next: ExtensionStorage,
): Promise<ExtensionStorage> => {
  let effective = next
  const scriptChanged = previous == null
    || previous.settings.fastInject !== next.settings.fastInject
    || !injectionConfigsEqual(createInjectionConfig(previous), createInjectionConfig(next))

  if (scriptChanged && !await syncRegisteredScript(next)) {
    effective = {
      ...next,
      settings: { ...next.settings, fastInject: false },
    }
    await replaceStorage(effective)
    await syncRegisteredScript(effective)
  }

  if (previous == null || requestHeaderValue(previous) !== requestHeaderValue(effective)) {
    await syncRequestHeader(effective)
  }
  return effective
}

export const synchronizeStorage = async (storage: ExtensionStorage): Promise<ExtensionStorage> => (
  synchronizeEffects(undefined, storage)
)

export const updateSettings = async (settings: FingerprintSettings): Promise<ExtensionStorage> => {
  const current = await getStorage()
  const normalized = { ...createDefaultSettings(), ...settings }
  if (settingsEqual(current.settings, normalized)) return current

  const next: ExtensionStorage = {
    ...current,
    settings: normalized,
    ipInfo: normalized.ipEnabled ? current.ipInfo : undefined,
  }
  await replaceStorage(next)
  return synchronizeEffects(current, next)
}

export const replaceAndSynchronizeStorage = async (
  current: ExtensionStorage,
  next: ExtensionStorage,
): Promise<ExtensionStorage> => {
  await replaceStorage(next)
  return synchronizeEffects(current, next)
}
