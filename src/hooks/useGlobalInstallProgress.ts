/**
 * 全局安装进度监听 Hook
 * 监听所有应用的安装进度事件和取消事件，并更新到下载列表中
 */
import { useEffect } from 'react'
import { onInstallProgress, onInstallCancelled } from '@/apis/invoke'
import { useDownloadConfigStore } from '@/stores/appConfig'

export const useGlobalInstallProgress = () => {
  const { updateAppProgress, removeDownloadingApp } = useDownloadConfigStore()

  useEffect(() => {
    let unlistenProgress: (() => void) | null = null
    let unlistenCancel: (() => void) | null = null

    const setupListener = async() => {
      console.log('[useGlobalInstallProgress] Setting up global install progress listener')

      // 监听安装进度
      unlistenProgress = await onInstallProgress((progress) => {
        console.log('[useGlobalInstallProgress] Progress event received:', progress)

        // 更新下载列表中对应 App 的进度
        updateAppProgress(progress.appId, progress.percentage, progress.status)
      })

      // 监听安装取消事件
      unlistenCancel = await onInstallCancelled((event) => {
        console.log('[useGlobalInstallProgress] Install cancelled event received:', event)

        // 从下载列表中移除该应用
        removeDownloadingApp(event.appId)
      })

      console.log('[useGlobalInstallProgress] Listener setup complete')
    }

    setupListener()

    // 组件卸载时清理监听器
    return () => {
      console.log('[useGlobalInstallProgress] Cleaning up listeners')
      if (unlistenProgress) {
        unlistenProgress()
      }
      if (unlistenCancel) {
        unlistenCancel()
      }
    }
  }, [updateAppProgress, removeDownloadingApp])
}
