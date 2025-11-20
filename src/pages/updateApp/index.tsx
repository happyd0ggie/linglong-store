import { Spin, Empty, Button, message } from 'antd'
import { useState } from 'react'
import styles from './index.module.scss'
import ApplicationCard from '@/components/ApplicationCard'
import { useCheckUpdates, type UpdateInfo } from '@/hooks/useCheckUpdates'
import { installApp } from '@/apis/invoke'
import { OPERATE_ACTIONS } from '@/components/ApplicationCard/types'
import DefaultImage from '@/assets/linyaps.svg'

const UpdateApp = () => {
  const { loading: checking, updates } = useCheckUpdates()
  const [installingApps, setInstallingApps] = useState<Set<string>>(new Set())
  const [updatingAll, setUpdatingAll] = useState(false)

  const handleUpdateApp = async(app: UpdateInfo) => {
    if (installingApps.has(app.appId)) {
      return
    }

    setInstallingApps(prev => new Set(prev).add(app.appId))
    try {
      message.loading({ content: `正在更新 ${app.name}...`, key: app.appId })
      // 调用安装接口，传入新版本号
      await installApp(app.appId, app.version)
      message.success({ content: `${app.name} 更新请求已提交`, key: app.appId })
      // 注意：这里不立即移除 installing 状态，因为安装是异步的，
      // 理想情况下应该监听安装进度事件来更新状态。
      // 但为了简化交互，我们可以在一段时间后移除，或者依赖全局安装状态管理。
      // 这里简单处理，3秒后移除 loading 状态，假设用户会去查看进度
      setTimeout(() => {
        setInstallingApps(prev => {
          const next = new Set(prev)
          next.delete(app.appId)
          return next
        })
      }, 3000)
    } catch (error) {
      console.error(`Failed to update ${app.name}:`, error)
      message.error({ content: `${app.name} 更新失败`, key: app.appId })
      setInstallingApps(prev => {
        const next = new Set(prev)
        next.delete(app.appId)
        return next
      })
    }
  }

  const handleUpdateAll = async() => {
    if (updates.length === 0) {
      return
    }
    setUpdatingAll(true)

    // 串行提交更新请求，避免瞬间并发过高
    for (const app of updates) {
      if (!installingApps.has(app.appId)) {
        await handleUpdateApp(app)
      }
    }

    setUpdatingAll(false)
  }

  // 将 UpdateInfo 转换为 ApplicationCard 需要的格式
  const mapUpdateInfoToCardOptions = (info: UpdateInfo) => ({
    appId: info.appId,
    name: info.name,
    version: info.version, // 显示新版本
    description: info.description,
    icon: info.icon,
    arch: info.arch,
    zhName: info.zhName || info.name,
  })

  return (
    <div className={styles.container}>
      <p className={styles.updateAppTitle}>更新应用：</p>

      <Spin spinning={checking && updates.length === 0} tip="正在检查更新...">
        {updates.length > 0 ? (
          <>
            <div className={styles.updateApplicationList}>
              {updates.map((app) => (
                <div key={app.appId} className={styles.cardWrapper}>
                  <ApplicationCard
                    operateId={OPERATE_ACTIONS.UPDATE}
                    options={mapUpdateInfoToCardOptions(app)}
                    loading={installingApps.has(app.appId)}
                    onUpdate={() => handleUpdateApp(app)}
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
                disabled={updatingAll || installingApps.size > 0}
              >
                    一键更新
              </Button>
            </div>
          </>
        ) : (
          !checking && (
            <div className={styles.emptyContainer}>
              <div style={{ width: 180, height: 180, margin: '0 auto' }}>
                <img src={DefaultImage} alt="No Data" style={{ width: '100%', height: '100%' }} />
              </div>
              <Empty description="暂无需更新应用" image={null} />
            </div>
          )
        )}
      </Spin>
    </div>
  )
}

export default UpdateApp
