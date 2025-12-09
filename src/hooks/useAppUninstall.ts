import { useCallback } from 'react'
import { message, Modal } from 'antd'
import { uninstallApp } from '@/apis/invoke'
import { useInstalledAppsStore } from '@/stores/installedApps'
import { useUpdatesStore } from '@/stores/updates'

type UninstallOptions = {
  /** 所有版本卸载完后的回调（例如跳转） */
  onAllRemoved?: () => void
  /** 是否静默，不弹出全局提示 */
  silent?: boolean
  /** 跳过确认弹窗 */
  skipConfirm?: boolean
  /** 自定义标题 */
  confirmTitle?: string
  /** 自定义文案 */
  confirmMessage?: string
}

type BasicAppInfo = {
  appId?: string
  version?: string
  name?: string
  zhName?: string
}

/**
 * 统一的卸载逻辑
 */
export const useAppUninstall = () => {
  const { removeApp } = useInstalledAppsStore()
  const checkUpdates = useUpdatesStore(state => state.checkUpdates)

  const performUninstall = useCallback(
    async(appId: string, version: string, options?: UninstallOptions) => {
      try {
        await uninstallApp(appId, version)

        removeApp(appId, version)

        const currentInstalled = useInstalledAppsStore.getState().installedApps
        const remainingVersions = currentInstalled.filter(item => item.appId === appId && item.version !== version)
        if (remainingVersions.length === 0 && options?.onAllRemoved) {
          options.onAllRemoved()
        }

        await checkUpdates(true)

        if (!options?.silent) {
          message.success('卸载成功')
        }
        return true
      } catch (error) {
        if (!options?.silent) {
          message.error(`卸载失败: ${error}`)
        }
        throw error
      }
    },
    [removeApp, checkUpdates],
  )

  const uninstall = useCallback(
    async(appInfo: BasicAppInfo, options?: UninstallOptions) => {
      const appId = appInfo.appId || ''
      const version = appInfo.version || ''

      if (!appId || !version) {
        message.error('应用信息不完整')
        return false
      }

      const confirmTitle = options?.confirmTitle ?? '确认卸载'
      const confirmMessage =
        options?.confirmMessage ??
        `确认要卸载 ${appInfo.zhName || appInfo.name || appId} 的版本 ${version} 吗？`

      if (options?.skipConfirm) {
        return performUninstall(appId, version, options)
      }

      return new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: confirmTitle,
          content: confirmMessage,
          okText: '确认',
          cancelText: '取消',
          onOk: async() => {
            try {
              const result = await performUninstall(appId, version, options)
              resolve(result)
            } catch (error) {
              resolve(false)
              console.error('Uninstall failed:', error)
            }
          },
          onCancel: () => resolve(false),
        })
      })
    },
    [performUninstall],
  )

  return { uninstall }
}
