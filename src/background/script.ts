import { coreInject } from '@/core/output'
import { getStorage, updateSettings } from './storage'

const SCRIPT_ID = 'fingerprint-core'
let scriptCode: string | undefined

export const hasUserScripts = async (): Promise<boolean> => {
  try {
    if (chrome.userScripts == null) return false
    await chrome.userScripts.getScripts()
    return true
  } catch {
    return false
  }
}

const needsInjection = ({ settings, ipInfo }: ExtensionStorage): boolean => (
  !settings.webrtcEnabled
  || (
    settings.ipEnabled
    && ipInfo != null
    && (settings.autoLanguages || settings.autoTimezone)
  )
)

const ensureFastInject = async (storage: ExtensionStorage): Promise<boolean> => {
  if (await hasUserScripts()) return storage.settings.fastInject
  if (storage.settings.fastInject) {
    await updateSettings({ ...storage.settings, fastInject: false })
  }
  return false
}

export const injectScript = async (tabId: number, storage: ExtensionStorage): Promise<void> => {
  if (!needsInjection(storage) || await ensureFastInject(storage)) return
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    world: 'MAIN',
    injectImmediately: true,
    args: [{ storage }],
    func: coreInject,
  }).catch(() => undefined)
}

const registeredCode = (storage: ExtensionStorage): string => {
  scriptCode ??= coreInject.toString()
  return `(${scriptCode})({storage:${JSON.stringify(storage)}});`
}

export const reRegisterScript = async (): Promise<void> => {
  const storage = await getStorage()
  const available = await ensureFastInject(storage)
  if (!available || !needsInjection(storage)) {
    if (chrome.userScripts != null) {
      await chrome.userScripts.unregister({ ids: [SCRIPT_ID] }).catch(() => undefined)
    }
    return
  }

  const scripts: chrome.userScripts.RegisteredUserScript[] = [{
    id: SCRIPT_ID,
    allFrames: true,
    runAt: 'document_start',
    world: 'MAIN',
    matches: ['*://*/*'],
    js: [{ code: registeredCode(storage) }],
  }]
  try {
    await chrome.userScripts.update(scripts)
  } catch {
    await chrome.userScripts.register(scripts)
  }
}
