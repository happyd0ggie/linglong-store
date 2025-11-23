import { Button, message, Modal, Typography } from 'antd'
import styles from './index.module.scss'
import { useNavigate } from 'react-router-dom'
import { useMemo, useCallback, useState, useEffect } from 'react'
import DefaultIcon from '@/assets/linyaps.svg'

import { uninstallApp, runApp } from '@/apis/invoke'
import { useInstalledAppsStore } from '@/stores/installedApps'
import { useUpdatesStore } from '@/stores/updates'
import { useAppInstall } from '@/hooks/useAppInstall'
import { compareVersions } from '@/util/checkVersion'

import { OperateType } from '@/constants/applicationCard'

const { Text, Paragraph, Title } = Typography

// 操作按钮配置（提取为常量）
const OPERATE_LIST: COMP.APPCARD.OperateItem[] = [
  { name: '卸载', id: OperateType.UNINSTALL },
  { name: '安装', id: OperateType.INSTALL },
  { name: '更新', id: OperateType.UPDATE },
  { name: '打开', id: OperateType.OPEN },
]

const ApplicationCard = ({
  operateId = OperateType.INSTALL,
  appInfo = {},
}: COMP.APPCARD.ApplicationCardProps) => {
  const navigate = useNavigate()

  const [buttonLoading, setButtonLoading] = useState(false)
  const [cardLoading, setCardLoading] = useState(false)

  const { handleInstall } = useAppInstall()

  const { installedApps, removeApp } = useInstalledAppsStore()
  const updates = useUpdatesStore(state => state.updates)

  useEffect(() => {
    if (appInfo && appInfo.appId && !appInfo.appId.startsWith('empty-')) {
      setCardLoading(false)
    } else {
      setCardLoading(true)
    }
  }, [appInfo])

  // 根据 store 中的安装状态和版本对比，决定展示的操作类型
  const resolvedOperateId = useMemo(() => {
    if (!appInfo?.appId) {
      return operateId
    }

    const installedApp = installedApps.find(app => app.appId === appInfo.appId)
    if (!installedApp) {
      // 应用未安装，显示安装按钮
      return OperateType.INSTALL
    }

    const hasUpdateInStore = updates.some(update => update.appId === appInfo.appId)

    // 应用已安装，检查是否有更新
    if (
      (appInfo.version && installedApp.version && compareVersions(appInfo.version, installedApp.version) > 0)
      || hasUpdateInStore
    ) {
      return OperateType.UPDATE
    }

    // 应用已安装且无更新，默认显示打开按钮
    // 只有当参数明确指定为卸载时才显示卸载按钮
    if (operateId === OperateType.UNINSTALL) {
      return OperateType.UNINSTALL
    }

    return OperateType.OPEN
  }, [appInfo?.appId, appInfo.version, installedApps, operateId, updates])

  // 计算当前显示的操作按钮
  const currentOperate = useMemo(() => {
    return OPERATE_LIST[resolvedOperateId] || OPERATE_LIST[OperateType.INSTALL]
  }, [resolvedOperateId])

  // 获取图标 URL
  const iconUrl = useMemo(() => {
    return appInfo.icon || DefaultIcon
  }, [appInfo.icon])

  // 跳转到应用详情页
  const handleNavigateToDetail = useCallback(() => {
    navigate('/app_detail', {
      state: {
        ...appInfo,
      },
    })
  }, [navigate, appInfo])

  // 处理操作按钮点击
  const handleOperateClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation() // 阻止事件冒泡到卡片点击事件

    setButtonLoading(true)

    if (resolvedOperateId === OperateType.UNINSTALL) {
      if (!appInfo.appId || !appInfo.version) {
        setButtonLoading(false)
        return
      }
      // 确认卸载操作
      Modal.confirm({
        title: '确认卸载',
        content: `确认要卸载 ${appInfo.zhName || appInfo.name || appInfo.appId} 的版本 ${appInfo.version} 吗`,
        okText: '确认',
        cancelText: '取消',
        onOk: async() => {
          try {
            await uninstallApp(appInfo.appId as string, appInfo.version as string)
            removeApp(appInfo.appId as string, appInfo.version as string)
            message.success('卸载成功')
          } catch (error) {
            console.error('[handleUninstall] 卸载失败:', error)
            message.error(`卸载失败: ${error}`)
          } finally {
            setButtonLoading(false)
          }
        },
        onCancel: () => {
          setButtonLoading(false)
        },
      })
    }

    // 如果是安装操作，调用安装
    if (resolvedOperateId === OperateType.INSTALL) {
      handleInstall(appInfo as API.APP.AppMainDto).finally(() => {
        setButtonLoading(false)
      })
    }

    // 更新操作直接复用安装逻辑
    if (resolvedOperateId === OperateType.UPDATE) {
      handleInstall(appInfo as API.APP.AppMainDto).finally(() => {
        setButtonLoading(false)
      })
    }

    // 打开操作
    if (resolvedOperateId === OperateType.OPEN) {
      if (!appInfo.appId) {
        setButtonLoading(false)
        return
      }

      const handleRunApp = async() => {
        try {
          await runApp(appInfo.appId as string)
          message.success('应用启动成功')
        } catch (error) {
          console.error('[handleRunApp] 启动应用失败:', error)
          message.error(`启动应用失败: ${error}`)
        } finally {
          setButtonLoading(false)
        }
      }

      handleRunApp()
    }
  }, [resolvedOperateId, appInfo, handleInstall, removeApp, runApp])

  return (
    <div
      className={`${styles.applicationCard} ${cardLoading ? styles.cardLoading : ''}`}
      onClick={handleNavigateToDetail}
    >
      <div className={styles.icon}>
        <img src={iconUrl} alt={appInfo.name || '应用图标'} />
      </div>

      <div className={styles.content}>
        <div className={styles.title}>
          <Title level={5} ellipsis={{ tooltip: appInfo.zhName || appInfo.name || '应用名称' }}>
            {appInfo.zhName || appInfo.name || '应用名称'}
          </Title>
        </div>

        <div className={styles.description}>
          <Paragraph ellipsis={{ tooltip: appInfo.description || '应用简介', rows: 2, expandable: false }}>
            {appInfo.description || '应用简介'}
          </Paragraph>
        </div>

        <div className={styles.version}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            版本: {appInfo.version || '-'}
          </Text>
        </div>
      </div>

      <div className={styles.actions}>
        <Button
          type='primary'
          style={
            resolvedOperateId === OperateType.OPEN
              ? { backgroundColor: '#1AD56C', borderColor: '#1AD56C' } // 绿色
              : {}
          }
          className={styles.installButton}
          size="small"
          loading={buttonLoading}
          onClick={handleOperateClick}
        >
          {currentOperate.name}
        </Button>
      </div>
    </div>
  )
}

export default ApplicationCard
