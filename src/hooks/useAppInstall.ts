/**
 * 应用安装功能的自定义 Hook
 * 统一管理应用安装逻辑，避免代码重复
 */
import { useState, useCallback } from 'react'
import { message } from 'antd'
import { installApp } from '@/apis/invoke'
import { useDownloadConfigStore } from '@/stores/appConfig'

type AppInfo = API.APP.AppMainDto

export const useAppInstall = () => {
  const [installingAppId, setInstallingAppId] = useState<string | null>(null)
  const { addAppToDownloadList } = useDownloadConfigStore()

  const handleInstall = useCallback(async(app: AppInfo) => {
    console.log('[useAppInstall] ✅ Function called with app:', app)

    if (!app?.appId) {
      console.error('[useAppInstall] ❌ App ID is missing!')
      message.error('应用信息不完整')
      return
    }

    setInstallingAppId(app.appId)
    try {
      console.log('[useAppInstall] 🚀 开始安装:', app.appId)

      // 先将应用添加到下载列表，初始进度为 0%
      addAppToDownloadList({
        ...app,
        flag: 'downloading',
        percentage: 0,
        installStatus: '准备安装...',
      })

      // 开始安装（进度通过全局监听器更新到下载列表）
      await installApp(app.appId)

      message.success({ content: '安装成功！', key: 'install' })
    } catch (error) {
      console.error('[useAppInstall] 安装失败:', error)
      message.error({
        content: `安装失败: ${error instanceof Error ? error.message : String(error)}`,
        key: 'install',
      })
    } finally {
      setInstallingAppId(null)
    }
  }, [addAppToDownloadList])

  return {
    installingAppId,
    handleInstall,
  }
}
