export type IPData = {
  query: string
  countryCode: string
  timezone: string
}

const isIpData = (value: unknown): value is IPData => {
  if (typeof value !== 'object' || value == null) return false
  const data = value as Record<string, unknown>
  return (
    typeof data.query === 'string'
    && typeof data.countryCode === 'string'
    && typeof data.timezone === 'string'
  )
}

export const IpApi = {
  async getIp(): Promise<IPData> {
    const response = await fetch('http://ip-api.com/json/')
    if (!response.ok) throw new Error(`IP API returned ${response.status}`)
    const data: unknown = await response.json()
    if (!isIpData(data)) throw new Error('IP API returned an invalid response')
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: data.timezone })
    } catch {
      throw new Error('IP API returned an invalid timezone')
    }
    return data
  },
}
