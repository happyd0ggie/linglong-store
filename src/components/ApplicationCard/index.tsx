import { Button, message, Modal, Typography } from 'antd'
import styles from './index.module.scss'
import { useNavigate } from 'react-router-dom'
import { useMemo, useCallback, useState, useEffect } from 'react'
import DefaultIcon from '@/assets/linyaps.svg'

import { uninstallApp } from '@/apis/invoke'
import { useInstalledAppsStore } from '@/stores/installedApps'
import { useAppInstall } from '@/hooks/useAppInstall'

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

  const { removeApp } = useInstalledAppsStore()

  useEffect(() => {
    if (appInfo && appInfo.appId && !appInfo.appId.startsWith('empty-')) {
      setCardLoading(false)
    } else {
      setCardLoading(true)
    }
  }, [appInfo])

  // 缓存当前操作按钮配置
  const currentOperate = useMemo(() => {
    return OPERATE_LIST[operateId] || OPERATE_LIST[OperateType.INSTALL]
  }, [operateId])

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

    if (operateId === OperateType.UNINSTALL) {
      if (!appInfo.appId || !appInfo.version) {
        setButtonLoading(false)
        return
      }
      // 处理卸载操作
      Modal.confirm({
        title: '确认卸载',
        content: `确定要卸载 ${appInfo.zhName || appInfo.name || appInfo.appId} 的版本 ${appInfo.version} 吗？`,
        okText: '确定',
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

    // 如果是安装操作且提供了回调函数，调用安装
    if (operateId === OperateType.INSTALL) {
      handleInstall(appInfo as API.APP.AppMainDto).finally(() => {
        setButtonLoading(false)
      })
    }

    // 如果是更新操作且提供了回调函数，调用更新
    if (operateId === OperateType.UPDATE) {
      // onUpdate(appInfo)
    }
  }, [operateId, appInfo])

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
          <Paragraph ellipsis={{ tooltip: appInfo.description || '应用描述', rows: 2, expandable: false }}>
            {appInfo.description || '应用描述'}
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
          type="primary"
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
