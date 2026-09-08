import { IpApi } from '@/api/ip'
import countryLanguages from '@/data/country_languages.json'
import { getStorage, replaceStorage } from './storage'
import { reRegisterScript } from './script'
import { reRequestHeader } from './request'

export const refreshIp = async (): Promise<ExtensionStorage> => {
  const current = await getStorage()
  if (!current.settings.ipEnabled) {
    if (current.ipInfo == null) return current
    const next = { ...current, ipInfo: undefined }
    await replaceStorage(next)
    await Promise.all([reRegisterScript(), reRequestHeader()])
    return next
  }

  const data = await IpApi.getIp()
  const languages = (countryLanguages as Record<string, string[]>)[data.countryCode] ?? []
  const next: ExtensionStorage = {
    ...current,
    ipInfo: {
      ip: data.query,
      countryCode: data.countryCode,
      timezone: data.timezone,
      languages,
      updatedAt: Date.now(),
    },
  }
  await replaceStorage(next)
  await Promise.all([reRegisterScript(), reRequestHeader()])
  return next
}
