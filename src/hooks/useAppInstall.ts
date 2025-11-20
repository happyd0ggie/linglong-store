/**
 * 应用安装功能的自定义 Hook
 * 统一管理应用安装逻辑，避免代码重复
 */
import { useState, useCallback } from 'react'
import { message, Modal } from 'antd'
import { installApp } from '@/apis/invoke'
import { useDownloadConfigStore } from '@/stores/appConfig'

type AppInfo = API.APP.AppMainDto

const extractErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

const isForceInstallHint = (text: string) => {
  if (!text) {
    return false
  }
  const normalized = text.replace(/\s+/g, ' ')
  return normalized.includes('ll-cli install') && normalized.includes('--force')
}

const confirmForceInstall = (content: string) => {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: '最新版本已安装',
      content: `${content}\n是否使用此版本进行替换？`,
      okText: '替换安装',
      cancelText: '取消',
      centered: true,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  })
}

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

      const executeInstall = async(force = false, skipDownloadInit = false) => {
        if (!skipDownloadInit) {
          addAppToDownloadList({
            ...app,
            flag: 'downloading',
            percentage: 0,
            installStatus: '准备安装...',
          })
        }
        await installApp(app.appId as string, undefined, force)
      }

      try {
        await executeInstall()
        message.success({ content: '安装成功！', key: 'install' })
      } catch (error) {
        const errorMessage = extractErrorMessage(error)
        console.error('[useAppInstall] 安装失败:', errorMessage)
        if (isForceInstallHint(errorMessage)) {
          const confirmed = await confirmForceInstall(errorMessage)
          if (confirmed) {
            try {
              await executeInstall(true, true)
              message.success({ content: '安装成功！', key: 'install' })
            } catch (forceError) {
              const forceMessage = extractErrorMessage(forceError)
              console.error('[useAppInstall] 强制安装失败:', forceMessage)
              message.error({
                content: `安装失败: ${forceMessage}`,
                key: 'install',
              })
            }
          }
        } else {
          message.error({
            content: `安装失败: ${errorMessage}`,
            key: 'install',
          })
        }
      }
    } finally {
      setInstallingAppId(null)
    }
  }, [addAppToDownloadList])

  return {
    installingAppId,
    handleInstall,
  }
}
