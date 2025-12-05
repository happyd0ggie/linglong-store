import { Spin, Empty, Button, message } from 'antd'
import { useState, useCallback, useMemo } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import styles from './index.module.scss'
import ApplicationCard from '@/components/ApplicationCard'
import { useCheckUpdates, type UpdateInfo } from '@/hooks/useCheckUpdates'
import { installApp } from '@/apis/invoke'
import { useDownloadConfigStore } from '@/stores/appConfig'

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

// ==================== 组件 ====================

const UpdateApp = () => {
  const { loading: checking, updates, checkUpdates } = useCheckUpdates()
  const { addAppToDownloadList, downloadList } = useDownloadConfigStore()

  const [updatingAll, setUpdatingAll] = useState(false)

  // 获取正在下载/更新中的应用ID集合
  const installingAppIds = useMemo(() => {
    const downloadingApps = downloadList.filter(app => app.flag === 'downloading')
    return new Set(downloadingApps.map(app => app.appId).filter(Boolean) as string[])
  }, [downloadList])

  /**
   * 更新单个应用
   * 将应用添加到下载列表并调用安装接口
   */
  const handleUpdateApp = useCallback(async(app: UpdateInfo) => {
    if (installingAppIds.has(app.appId)) {
      message.warning(`${app.zhName || app.name} 正在更新中`)
      return
    }

    try {
      // 添加到下载列表，显示进度
      addAppToDownloadList({
        appId: app.appId,
        name: app.name,
        zhName: app.zhName,
        icon: app.icon,
        version: app.version,
        description: app.description,
        arch: app.arch,
        flag: 'downloading',
        percentage: 0,
        installStatus: '准备更新...',
      })

      // 调用安装接口，传入新版本号
      await installApp(app.appId, app.version)
      message.success({ content: `${app.zhName || app.name} 更新请求已提交`, key: app.appId })

    } catch (error) {
      console.error(`[UpdateApp] Failed to update ${app.appId}:`, error)
      message.error({ content: `${app.zhName || app.name} 更新失败`, key: app.appId })
    }
  }, [installingAppIds, addAppToDownloadList])

  /**
   * 一键更新所有应用
   * 串行提交更新请求，避免瞬间并发过高
   */
  const handleUpdateAll = useCallback(async() => {
    if (updates.length === 0) {
      return
    }

    setUpdatingAll(true)
    message.loading({ content: '正在提交更新请求...', key: 'update-all' })

    let successCount = 0
    let failCount = 0

    // 串行提交更新请求
    for (const app of updates) {
      if (!installingAppIds.has(app.appId)) {
        try {
          await handleUpdateApp(app)
          successCount++
        } catch {
          failCount++
        }
      }
    }

    setUpdatingAll(false)

    // 显示结果汇总
    if (failCount === 0) {
      message.success({ content: `已提交 ${successCount} 个应用的更新请求`, key: 'update-all' })
    } else {
      message.warning({ content: `成功 ${successCount} 个，失败 ${failCount} 个`, key: 'update-all' })
    }
  }, [updates, installingAppIds, handleUpdateApp])

  /**
   * 手动检查更新
   */
  const handleCheckUpdates = useCallback(() => {
    checkUpdates(true)
    message.info('正在检查更新...')
  }, [checkUpdates])

  // 是否禁用一键更新按钮
  const isUpdateAllDisabled = updatingAll || installingAppIds.size > 0 || updates.length === 0

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
                loading={updatingAll}
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
