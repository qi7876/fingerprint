import { coreInject } from '@/core/output'
import { createInjectionConfig } from '@/config'

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

const needsInjection = (config: InjectionConfig): boolean => (
  config.disableWebRtc || config.languages != null || config.timezone != null
)

export const injectScript = async (tabId: number, storage: ExtensionStorage): Promise<void> => {
  const config = createInjectionConfig(storage)
  if (!needsInjection(config) || storage.settings.fastInject) return
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    world: 'MAIN',
    injectImmediately: true,
    args: [{ config }],
    func: coreInject,
  }).catch(() => undefined)
}

const registeredCode = (config: InjectionConfig): string => {
  scriptCode ??= coreInject.toString()
  return `(${scriptCode})({config:${JSON.stringify(config)}});`
}

export const syncRegisteredScript = async (storage: ExtensionStorage): Promise<boolean> => {
  const config = createInjectionConfig(storage)
  if (!storage.settings.fastInject || !needsInjection(config)) {
    if (chrome.userScripts != null) {
      await chrome.userScripts.unregister({ ids: [SCRIPT_ID] }).catch(() => undefined)
    }
    return true
  }
  if (!await hasUserScripts()) return false

  const scripts: chrome.userScripts.RegisteredUserScript[] = [{
    id: SCRIPT_ID,
    allFrames: true,
    runAt: 'document_start',
    world: 'MAIN',
    matches: ['*://*/*'],
    js: [{ code: registeredCode(config) }],
  }]
  try {
    await chrome.userScripts.update(scripts)
  } catch {
    await chrome.userScripts.register(scripts)
  }
  return true
}
