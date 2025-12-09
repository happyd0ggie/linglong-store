/**
 * 全局安装进度监听 Hook
 * 监听所有应用的安装进度事件，并更新到安装队列 Store 中
 *
 * 注意：此 Hook 应该在应用根组件中调用一次，确保全局监听
 */
import { useEffect } from 'react'
import { message } from 'antd'
import { onInstallProgress } from '@/apis/invoke'
import { useInstallQueueStore } from '@/stores/installQueue'
import { useUpdatesStore } from '@/stores/updates'
import { useInstalledAppsStore } from '@/stores/installedApps'

export const useGlobalInstallProgress = () => {
  const { updateProgress, markSuccess, markFailed, currentTask } = useInstallQueueStore()
  const checkUpdates = useUpdatesStore((state) => state.checkUpdates)
  const checkingUpdates = useUpdatesStore((state) => state.checking)
  const fetchInstalledApps = useInstalledAppsStore((state) => state.fetchInstalledApps)

  useEffect(() => {
    let unlistenProgress: (() => void) | null = null

    const setupListener = async() => {
      // 监听安装进度
      unlistenProgress = await onInstallProgress((progress) => {
        console.info('[useGlobalInstallProgress] Progress received:', progress)

        // 更新队列中对应任务的进度
        updateProgress(progress.appId, progress.percentage, progress.status)

        // 检查是否安装完成
        if (progress.percentage >= 100 || progress.status.includes('安装完成')) {
          console.info(`[useGlobalInstallProgress] Install completed for: ${progress.appId}`)

          // 标记任务成功
          markSuccess(progress.appId)

          // 显示成功消息
          const appName = currentTask?.appInfo?.zhName || currentTask?.appInfo?.name || progress.appId
          message.success({
            content: `${appName} 安装成功！`,
            key: `install-success-${progress.appId}`,
          })

          // 后台刷新已安装列表和更新列表
          if (!checkingUpdates) {
            checkUpdates()
          }
          fetchInstalledApps().catch((err) =>
            console.error('[useGlobalInstallProgress] Failed to refresh installed apps:', err),
          )
        }

        // 检查是否安装失败
        if (progress.progress === 'error' || progress.status.includes('失败')) {
          console.error(`[useGlobalInstallProgress] Install failed for: ${progress.appId}`, progress.status)

          // 标记任务失败
          markFailed(progress.appId, progress.status)

          // 显示失败消息
          const appName = currentTask?.appInfo?.zhName || currentTask?.appInfo?.name || progress.appId
          message.error({
            content: `${appName} 安装失败：${progress.status}`,
            key: `install-failed-${progress.appId}`,
          })
        }
      })

      console.info('[useGlobalInstallProgress] Listener setup complete')
    }

    setupListener()

    // 组件卸载时清理监听器
    return () => {
      if (unlistenProgress) {
        console.info('[useGlobalInstallProgress] Cleaning up listener')
        unlistenProgress()
      }
    }
  }, [updateProgress, markSuccess, markFailed, currentTask, checkUpdates, checkingUpdates, fetchInstalledApps])
}

