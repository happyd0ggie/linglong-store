import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, App } from 'antd'
import './styles/App.scss'
import { Token, ComponentsTheme } from './styles/Theme'
import Router from './router'
import { tauriAppConfigHandler } from './stores/appConfig'
import { setupLoggingBridge } from './util/logging'

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

// 在生产环境禁用右键菜单
if (import.meta.env.PRO) {
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault()
  })
}

// 初始化应用配置并渲染
async function initializeApp() {
  await setupLoggingBridge()

  await tauriAppConfigHandler.start()

  // 在开发环境使用 StrictMode 进行检测
  // 在生产环境移除 StrictMode 以避免性能开销
  if (import.meta.env.DEV) {
    root.render(
      <React.StrictMode>
        <ConfigProvider theme={{ cssVar: true, hashed: false, token: Token, components: ComponentsTheme }}>
          <App><Router /></App>
        </ConfigProvider>
      </React.StrictMode>,
    )
  } else {
    root.render(
      <ConfigProvider theme={{ cssVar: true, hashed: false, token: Token, components: ComponentsTheme }}>
        <App><Router /></App>
      </ConfigProvider>,
    )
  }
}

// 启动应用
initializeApp().catch((error) => {
  console.error('Failed to initialize app:', error)
})
