import React from 'react'
import ReactDOM from 'react-dom/client'
import { App, ConfigProvider, theme } from 'antd'

import './index.css'
import Application from './App'

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        cssVar: true,
        algorithm: prefersDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { colorPrimary: '#1fc18a', borderRadius: 6 },
      }}
    >
      <App>
        <Application />
      </App>
    </ConfigProvider>
  </React.StrictMode>,
)
