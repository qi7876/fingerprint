import './index.css'

import { requestPermission } from '@/utils/browser'
import { sendToBackground } from '@/utils/message'

const element = <T extends HTMLElement>(id: string): T => {
  const value = document.getElementById(id)
  if (value == null) throw new Error(`Missing popup element: #${id}`)
  return value as T
}

const app = element<HTMLElement>('app')
const ipEnabled = element<HTMLInputElement>('ip-enabled')
const autoTimezone = element<HTMLInputElement>('auto-timezone')
const autoLanguages = element<HTMLInputElement>('auto-languages')
const webrtcEnabled = element<HTMLInputElement>('webrtc-enabled')
const fastInjectEnabled = element<HTMLInputElement>('fast-inject-enabled')
const refreshButton = element<HTMLButtonElement>('refresh-ip')
const status = element<HTMLDivElement>('status')

const infoFields = {
  ip: element<HTMLElement>('ip-value'),
  country: element<HTMLElement>('country-value'),
  timezone: element<HTMLElement>('timezone-value'),
  languages: element<HTMLElement>('languages-value'),
  updated: element<HTMLElement>('updated-value'),
}

let storage: ExtensionStorage | undefined

const setStatus = (message?: string, kind: 'error' | 'warning' = 'error'): void => {
  status.hidden = message == null
  status.textContent = message ?? ''
  status.classList.toggle('warning', kind === 'warning')
}

const render = (next: ExtensionStorage): void => {
  storage = next
  const { settings, ipInfo } = next

  ipEnabled.checked = settings.ipEnabled
  autoTimezone.checked = settings.autoTimezone
  autoLanguages.checked = settings.autoLanguages
  webrtcEnabled.checked = settings.webrtcEnabled
  fastInjectEnabled.checked = settings.fastInject

  autoTimezone.disabled = !settings.ipEnabled
  autoLanguages.disabled = !settings.ipEnabled
  refreshButton.disabled = !settings.ipEnabled

  infoFields.ip.textContent = ipInfo?.ip || '--'
  infoFields.country.textContent = ipInfo?.countryCode || '--'
  infoFields.timezone.textContent = ipInfo?.timezone || '--'
  infoFields.languages.textContent = ipInfo?.languages.join(', ') || '--'
  infoFields.updated.textContent = ipInfo == null
    ? '--'
    : new Date(ipInfo.updatedAt).toLocaleString('en-US')

  app.setAttribute('aria-busy', 'false')
}

const saveSetting = async (key: keyof FingerprintSettings, value: boolean): Promise<void> => {
  if (storage == null) return
  setStatus()
  try {
    const settings = { ...storage.settings, [key]: value }
    render(await sendToBackground({ type: 'settings.set', settings }))
  } catch (error) {
    render(storage)
    setStatus(error instanceof Error ? error.message : String(error))
  }
}

const refreshIp = async (): Promise<void> => {
  refreshButton.disabled = true
  refreshButton.textContent = 'Refreshing…'
  setStatus()
  try {
    const result = await sendToBackground({ type: 'ip.refresh' })
    if (result.ok) {
      render(result.storage)
    } else {
      setStatus(`IP refresh failed: ${result.message}`)
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error))
  } finally {
    refreshButton.textContent = 'Refresh IP'
    refreshButton.disabled = storage?.settings.ipEnabled !== true
  }
}

ipEnabled.addEventListener('change', () => {
  void saveSetting('ipEnabled', ipEnabled.checked).then(() => {
    if (storage?.settings.ipEnabled) void refreshIp()
  })
})

autoTimezone.addEventListener('change', () => {
  void saveSetting('autoTimezone', autoTimezone.checked)
})

autoLanguages.addEventListener('change', () => {
  void saveSetting('autoLanguages', autoLanguages.checked)
})

webrtcEnabled.addEventListener('change', () => {
  void saveSetting('webrtcEnabled', webrtcEnabled.checked)
})

fastInjectEnabled.addEventListener('change', () => {
  void (async () => {
    try {
      const enabled = fastInjectEnabled.checked
      if (enabled) {
        const granted = await requestPermission('userScripts')
        const available = granted
          && await sendToBackground({ type: 'api.check', api: 'userScripts' })
        if (!available) {
          fastInjectEnabled.checked = false
          setStatus('Fast injection is unavailable or permission was denied.', 'warning')
          return
        }
      }
      await saveSetting('fastInject', enabled)
    } catch (error) {
      fastInjectEnabled.checked = storage?.settings.fastInject === true
      setStatus(error instanceof Error ? error.message : String(error))
    }
  })()
})

refreshButton.addEventListener('click', () => {
  void refreshIp()
})

void sendToBackground({ type: 'storage.get' })
  .then(render)
  .catch((error: unknown) => {
    app.setAttribute('aria-busy', 'false')
    setStatus(error instanceof Error ? error.message : String(error))
  })
