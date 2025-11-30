/**
 * 全局安装进度监听 Hook
 * 监听所有应用的安装进度事件和取消事件，并更新到下载列表中
 */
import { useEffect } from 'react'
import { onInstallProgress, onInstallCancelled } from '@/apis/invoke'
import { useDownloadConfigStore } from '@/stores/appConfig'
import { useUpdatesStore } from '@/stores/updates'
import { useInstalledAppsStore } from '@/stores/installedApps'

export const useGlobalInstallProgress = () => {
  const { updateAppProgress, removeDownloadingApp } = useDownloadConfigStore()
  const checkUpdates = useUpdatesStore(state => state.checkUpdates)
  const checkingUpdates = useUpdatesStore(state => state.checking)
  const removeUpdate = useUpdatesStore(state => state.removeUpdate)
  const fetchInstalledApps = useInstalledAppsStore(state => state.fetchInstalledApps)

  useEffect(() => {
    let unlistenProgress: (() => void) | null = null
    let unlistenCancel: (() => void) | null = null

    const setupListener = async() => {
      // 监听安装进度
      unlistenProgress = await onInstallProgress((progress) => {
        // 更新下载列表中对应 App 的进度
        updateAppProgress(progress.appId, progress.percentage, progress.status)

        // 安装/更新完成后立即从待更新列表移除，并刷新列表/安装信息
        if (progress.percentage >= 100 || progress.status.includes('安装完成')) {
          removeUpdate(progress.appId)
        }

        // 后台刷新更新列表（正在检查则跳过本次），确保数据最终一致
        if ((progress.percentage >= 100 || progress.status.includes('安装完成')) && !checkingUpdates) {
          checkUpdates()
          fetchInstalledApps().catch(err => console.error('[useGlobalInstallProgress] Failed to refresh installed apps:', err))
        }
      })

      // 监听安装取消事件
      unlistenCancel = await onInstallCancelled((event) => {
        // 从下载列表中移除该应用
        removeDownloadingApp(event.appId)
      })
    }

    setupListener()

    // 组件卸载时清理监听器
    return () => {
      if (unlistenProgress) {
        unlistenProgress()
      }
      if (unlistenCancel) {
        unlistenCancel()
      }
    }
  }, [updateAppProgress, removeDownloadingApp, checkUpdates, checkingUpdates, removeUpdate, fetchInstalledApps])
}
