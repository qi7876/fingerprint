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
