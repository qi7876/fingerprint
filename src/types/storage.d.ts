type FingerprintSettings = {
  ipEnabled: boolean
  autoTimezone: boolean
  autoLanguages: boolean
  webrtcEnabled: boolean
  fastInject: boolean
}

type IpInfo = {
  ip: string
  countryCode: string
  timezone: string
  languages: string[]
  updatedAt: number
}

type ExtensionStorage = {
  schemaVersion: 1
  settings: FingerprintSettings
  ipInfo?: IpInfo
}

type InjectionConfig = {
  disableWebRtc: boolean
  languages?: readonly string[]
  timezone?: string
}
