export const STORAGE_SCHEMA_VERSION = 1 as const

export const createDefaultSettings = (): FingerprintSettings => ({
  ipEnabled: false,
  autoTimezone: true,
  autoLanguages: true,
  webrtcEnabled: true,
  fastInject: false,
})

export const formatAcceptLanguage = (languages: readonly string[]): string => {
  const [primary, ...remaining] = languages
  if (primary == null) return ''
  return [primary, ...remaining.map((language, index) => (
    `${language};q=${Math.max(0.1, 0.9 - index * 0.1).toFixed(1)}`
  ))].join(',')
}

export const createInjectionConfig = ({ settings, ipInfo }: ExtensionStorage): InjectionConfig => ({
  disableWebRtc: !settings.webrtcEnabled,
  languages: settings.ipEnabled && settings.autoLanguages && ipInfo?.languages.length
    ? ipInfo.languages
    : undefined,
  timezone: settings.ipEnabled && settings.autoTimezone
    ? ipInfo?.timezone
    : undefined,
})

export const injectionConfigsEqual = (left: InjectionConfig, right: InjectionConfig): boolean => (
  left.disableWebRtc === right.disableWebRtc
  && left.timezone === right.timezone
  && left.languages?.length === right.languages?.length
  && left.languages?.every((language, index) => language === right.languages?.[index]) !== false
)
