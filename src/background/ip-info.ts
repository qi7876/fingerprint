import { IpApi } from '@/api/ip'
import countryLanguages from '@/data/country_languages.json'
import { getStorage, replaceAndSynchronizeStorage, replaceStorage } from './storage'

export const refreshIp = async (synchronize = true): Promise<ExtensionStorage> => {
  const current = await getStorage()
  if (!current.settings.ipEnabled) {
    if (current.ipInfo == null) return current
    const next = { ...current, ipInfo: undefined }
    return synchronize
      ? replaceAndSynchronizeStorage(current, next)
      : replaceStorage(next)
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
  return synchronize
    ? replaceAndSynchronizeStorage(current, next)
    : replaceStorage(next)
}
