import { refreshIp } from './ip-info'
import { reRequestHeader } from './request'
import { hasUserScripts, injectScript, reRegisterScript } from './script'
import { getStorage, initStorage, updateSettings } from './storage'

const initialize = async (): Promise<void> => {
  await initStorage()
  await Promise.all([reRegisterScript(), reRequestHeader()])
}

chrome.runtime.onInstalled.addListener(() => {
  void initialize()
})

chrome.runtime.onStartup.addListener(() => {
  void initialize().then(async () => {
    const storage = await getStorage()
    if (storage.settings.ipEnabled) {
      await refreshIp().catch(() => undefined)
    }
  })
})

chrome.runtime.onMessage.addListener(((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'storage.get':
      void getStorage().then(sendResponse)
      return true
    case 'settings.set':
      void updateSettings(message.settings).then(sendResponse)
      return true
    case 'ip.refresh':
      void refreshIp()
        .then((storage) => sendResponse({ ok: true, storage }))
        .catch((error: unknown) => sendResponse({
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        }))
      return true
    case 'api.check':
      void hasUserScripts().then(sendResponse)
      return true
  }
}) as BackgroundMessage.Listener)

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'loading') return
  void getStorage().then((storage) => injectScript(tabId, storage))
})

chrome.permissions.onAdded.addListener((permissions) => {
  if (permissions.permissions?.includes('userScripts')) {
    void reRegisterScript()
  }
})

chrome.permissions.onRemoved.addListener((permissions) => {
  if (!permissions.permissions?.includes('userScripts')) return
  void getStorage().then((storage) => (
    updateSettings({ ...storage.settings, fastInject: false })
  ))
})

void initialize()
