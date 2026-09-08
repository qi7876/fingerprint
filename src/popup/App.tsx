import { Alert, Button, Card, Layout, Space, Spin, Switch, Typography, message } from 'antd'
import { useEffect, useState } from 'react'

import { requestPermission } from '@/utils/browser'
import { sendToBackground } from '@/utils/message'

type SettingKey = keyof FingerprintSettings

const Application = () => {
  const [storage, setStorage] = useState<ExtensionStorage>()
  const [loadingIp, setLoadingIp] = useState(false)
  const [error, setError] = useState<string>()
  const [messageApi, contextHolder] = message.useMessage()

  useEffect(() => {
    void sendToBackground({ type: 'storage.get' }).then(setStorage)
  }, [])

  const saveSetting = async (key: SettingKey, value: boolean): Promise<ExtensionStorage | undefined> => {
    if (storage == null) return undefined
    const settings = { ...storage.settings, [key]: value }
    const next = await sendToBackground({ type: 'settings.set', settings })
    setStorage(next)
    return next
  }

  const refreshIp = async (): Promise<void> => {
    setLoadingIp(true)
    setError(undefined)
    const result = await sendToBackground({ type: 'ip.refresh' })
    setLoadingIp(false)
    if (result.ok) {
      setStorage(result.storage)
    } else {
      setError(result.message)
    }
  }

  const toggleIp = async (enabled: boolean): Promise<void> => {
    await saveSetting('ipEnabled', enabled)
    if (enabled) await refreshIp()
  }

  const toggleFastInject = async (enabled: boolean): Promise<void> => {
    if (enabled) {
      const granted = await requestPermission('userScripts')
      const available = granted && await sendToBackground({ type: 'api.check', api: 'userScripts' })
      if (!available) {
        messageApi.warning('Fast injection is unavailable or permission was denied.')
        return
      }
    }
    await saveSetting('fastInject', enabled)
  }

  if (storage == null) {
    return <Layout className='w-96 h-[520px] flex items-center justify-center'><Spin /></Layout>
  }

  const { settings, ipInfo } = storage

  return (
    <Layout className='w-96 max-h-[600px] overflow-y-auto p-3'>
      {contextHolder}
      <Typography.Title level={3} className='!mb-3 text-center'>fingerprint</Typography.Title>

      <Space direction='vertical' size='middle' className='w-full'>
        <Card
          size='small'
          title='IP Module'
          extra={<Switch checked={settings.ipEnabled} onChange={(value) => void toggleIp(value)} />}
        >
          <Space direction='vertical' className='w-full'>
            <SettingRow
              label='Set timezone automatically'
              checked={settings.autoTimezone}
              disabled={!settings.ipEnabled}
              onChange={(value) => void saveSetting('autoTimezone', value)}
            />
            <SettingRow
              label='Set languages automatically'
              checked={settings.autoLanguages}
              disabled={!settings.ipEnabled}
              onChange={(value) => void saveSetting('autoLanguages', value)}
            />

            <div className='rounded-lg bg-[--ant-color-fill-quaternary] p-2 text-sm'>
              <InfoRow label='IP' value={ipInfo?.ip} />
              <InfoRow label='Country' value={ipInfo?.countryCode} />
              <InfoRow label='Timezone' value={ipInfo?.timezone} />
              <InfoRow label='Languages' value={ipInfo?.languages.join(', ')} />
              <InfoRow
                label='Updated'
                value={ipInfo == null ? undefined : new Date(ipInfo.updatedAt).toLocaleString('en-US')}
              />
            </div>

            {error != null && <Alert type='error' showIcon message='IP refresh failed' description={error} />}
            <Button block loading={loadingIp} disabled={!settings.ipEnabled} onClick={() => void refreshIp()}>
              Refresh IP
            </Button>
          </Space>
        </Card>

        <Card size='small' title='WebRTC'>
          <SettingRow
            label={settings.webrtcEnabled ? 'Enabled' : 'Disabled'}
            checked={settings.webrtcEnabled}
            onChange={(value) => void saveSetting('webrtcEnabled', value)}
          />
          <Typography.Text type='secondary' className='text-xs'>
            When disabled, WebRTC and media APIs are removed from web pages.
          </Typography.Text>
        </Card>

        <Card size='small' title='Fast injection'>
          <SettingRow
            label={settings.fastInject ? 'Enabled' : 'Disabled'}
            checked={settings.fastInject}
            onChange={(value) => void toggleFastInject(value)}
          />
          <Typography.Text type='secondary' className='text-xs'>
            Uses Chrome&apos;s userScripts API to inject earlier. Compatibility mode is used when disabled.
          </Typography.Text>
        </Card>
      </Space>
    </Layout>
  )
}

type SettingRowProps = {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

const SettingRow = ({ label, checked, disabled, onChange }: SettingRowProps) => (
  <div className='flex items-center justify-between gap-3'>
    <Typography.Text>{label}</Typography.Text>
    <Switch checked={checked} disabled={disabled} onChange={onChange} />
  </div>
)

const InfoRow = ({ label, value }: { label: string; value?: string }) => (
  <div className='grid grid-cols-[90px_1fr] gap-2'>
    <Typography.Text type='secondary'>{label}</Typography.Text>
    <Typography.Text className='break-all'>{value || '--'}</Typography.Text>
  </div>
)

export default Application
