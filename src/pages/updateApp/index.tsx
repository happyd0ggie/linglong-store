import { Spin, Empty, Button, message } from 'antd'
import { useCallback, useMemo } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import styles from './index.module.scss'
import ApplicationCard from '@/components/ApplicationCard'
import { useCheckUpdates, type UpdateInfo } from '@/hooks/useCheckUpdates'
import { useAppInstall } from '@/hooks/useAppInstall'
import { useInstallQueueStore } from '@/stores/installQueue'

// ==================== 类型定义 ====================

/** 应用卡片展示信息 */
interface AppCardInfo {
  appId: string
  name: string
  version: string
  description: string
  icon: string
  arch: string
  zhName: string
}

// ==================== 辅助函数 ====================

/**
 * 将 UpdateInfo 转换为 ApplicationCard 需要的格式
 */
const mapUpdateInfoToCardOptions = (info: UpdateInfo): AppCardInfo => ({
  appId: info.appId,
  name: info.name,
  version: info.version,
  description: info.description,
  icon: info.icon,
  arch: info.arch,
  zhName: info.zhName || info.name,
})

/**
 * 将 UpdateInfo 转换为 AppMainDto 格式（用于安装队列）
 */
const mapUpdateInfoToAppDto = (info: UpdateInfo): API.APP.AppMainDto => ({
  appId: info.appId,
  name: info.name,
  zhName: info.zhName,
  icon: info.icon,
  version: info.version,
  description: info.description,
  arch: info.arch,
})

// ==================== 组件 ====================

const UpdateApp = () => {
  const { loading: checking, updates, checkUpdates } = useCheckUpdates()
  const { handleBatchInstall, isAppInQueue } = useAppInstall()
  const { queue, currentTask, isProcessing } = useInstallQueueStore()

  // 获取正在安装/队列中的应用ID集合
  const installingAppIds = useMemo(() => {
    const ids = new Set<string>()

    // 当前正在安装的
    if (currentTask?.appId) {
      ids.add(currentTask.appId)
    }

    // 队列中等待的
    queue.forEach((task) => {
      if (task.appId) {
        ids.add(task.appId)
      }
    })

    return ids
  }, [currentTask, queue])

  /**
   * 一键更新所有应用
   * 批量加入安装队列，串行执行
   */
  const handleUpdateAll = useCallback(() => {
    if (updates.length === 0) {
      return
    }

    // 过滤掉已在队列中的应用
    const appsToUpdate = updates.filter((app) => !isAppInQueue(app.appId))

    if (appsToUpdate.length === 0) {
      message.warning('所有应用都已在更新队列中')
      return
    }

    // 构建批量安装任务
    const tasks = appsToUpdate.map((app) => ({
      appInfo: mapUpdateInfoToAppDto(app),
      version: app.version,
      force: false,
    }))

    // 批量入队
    handleBatchInstall(tasks)
  }, [updates, isAppInQueue, handleBatchInstall])

  /**
   * 手动检查更新
   */
  const handleCheckUpdates = useCallback(() => {
    checkUpdates(true)
    message.info('正在检查更新...')
  }, [checkUpdates])

  // 是否禁用一键更新按钮
  const isUpdateAllDisabled = isProcessing || installingAppIds.size > 0 || updates.length === 0

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <p className={styles.updateAppTitle}>更新应用：</p>
        <Button
          type="text"
          icon={<ReloadOutlined spin={checking} />}
          onClick={handleCheckUpdates}
          disabled={checking}
        >
          检查更新
        </Button>
      </div>

      <Spin spinning={checking && updates.length === 0} tip="正在检查更新...">
        {updates.length > 0 ? (
          <>
            <div className={styles.updateApplicationList}>
              {updates.map((app) => (
                <div key={app.appId} className={styles.cardWrapper}>
                  <ApplicationCard
                    operateId={4}
                    appInfo={mapUpdateInfoToCardOptions(app)}
                  />
                </div>
              ))}
            </div>

            <div className={styles.floatingBtnContainer}>
              <Button
                type="primary"
                size="large"
                shape="round"
                onClick={handleUpdateAll}
                loading={isProcessing}
                disabled={isUpdateAllDisabled}
              >
                一键更新 ({updates.length})
              </Button>
            </div>
          </>
        ) : (
          !checking && (
            <div className={styles.emptyContainer}>
              <Empty description="暂无需更新应用" image={null} />
            </div>
          )
        )}
      </Spin>
    </div>
  )
}

export default UpdateApp
