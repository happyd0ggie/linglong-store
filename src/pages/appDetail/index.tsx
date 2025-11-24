import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Typography, Table, message, Modal, Spin, Space, Progress, Image } from 'antd'
import type { TableColumnProps } from 'antd'
import styles from './index.module.scss'
import goBack from '@/assets/icons/go_back.svg'
import DefaultIcon from '@/assets/linyaps.svg'

import { getAppDetail, getSearchAppVersionList } from '@/apis/apps'
import { searchVersions, uninstallApp, runApp, installApp, onInstallProgress, onInstallCancelled } from '@/apis/invoke'
import { useInstalledAppsStore } from '@/stores/installedApps'
import { useDownloadConfigStore } from '@/stores/appConfig'
import { useGlobalStore } from '@/stores/global'
import { compareVersions } from '@/util/checkVersion'
import { formatFileSize } from '@/util/format'

interface VersionInfo extends API.APP.AppMainDto {
  version?: string
}

const AppDetail = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const app = location.state as API.INVOKE.InstalledApp | undefined

  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [installedVersionSet, setInstalledVersionSet] = useState<Set<string>>(new Set())

  const [screenshotList, setScreenshotList] = useState<API.APP.AppScreenshot[]>([])
  const [loading, setLoading] = useState(false)
  const [uninstallingVersion, setUninstallingVersion] = useState<string | null>(null)
  const [installingVersion, setInstallingVersion] = useState<string | null>(null)
  const [isInstalling, setIsInstalling] = useState(false)
  const [installProgress, setInstallProgress] = useState<API.INVOKE.InstallProgress | null>(null)
  const removeApp = useInstalledAppsStore((state) => state.removeApp)
  const installedApps = useInstalledAppsStore((state) => state.installedApps)
  const arch = useGlobalStore((state) => state.arch)
  const repoName = useGlobalStore((state) => state.repoName)
  const { addAppToDownloadList } = useDownloadConfigStore()
  const installCompletionRef = useRef(false)
  const progressClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetInstallState = (options?: { immediate?: boolean }) => {
    if (progressClearTimerRef.current) {
      clearTimeout(progressClearTimerRef.current)
      progressClearTimerRef.current = null
    }

    setIsInstalling(false)
    setInstallingVersion(null)

    if (options?.immediate) {
      setInstallProgress(null)
      return
    }

    progressClearTimerRef.current = setTimeout(() => {
      setInstallProgress(null)
      progressClearTimerRef.current = null
    }, 1200)
  }
  // 从 store 中获取最新的应用信息（包括图标）
  const currentApp = useMemo(() => {
    if (!app?.appId) {
      return app
    }

    // 查找 store 中对应的应用，优先使用 store 中的数据（图标可能已加载）
    const storeApp = installedApps.find(
      item => item.appId === app.appId && item.version === app.version,
    )

    // 如果 store 中有该应用且图标已加载，使用 store 中的数据
    // 否则使用传递过来的数据
    if (storeApp && storeApp.icon && storeApp.icon !== app.icon) {
      return { ...app, ...storeApp }
    }

    return app
  }, [app, installedApps])

  // 设置安装进度监听器和取消事件监听器
  useEffect(() => {
    let unlistenProgress: (() => void) | null = null
    let unlistenCancel: (() => void) | null = null

    const setupListener = async() => {
      console.info('[useEffect] Setting up install progress listener for appId:', currentApp?.appId)

      // 监听安装进度
      unlistenProgress = await onInstallProgress((progress) => {
        console.info('[useEffect] Install progress received:', progress)
        if (progress.appId !== currentApp?.appId) {
          console.info('[useEffect] AppId not matched. Expected:', currentApp?.appId, 'Got:', progress.appId)
          return
        }

        setInstallProgress(progress)

        if (progress.progress === 'error') {
          console.info('[useEffect] Installation failed for current app, resetting state')
          message.error({ content: progress.status || '安装失败', key: 'install' })
          installCompletionRef.current = true
          resetInstallState({ immediate: true })
          return
        }

        if (progress.percentage >= 100) {
          if (!installCompletionRef.current) {
            console.info('[useEffect] Installation finished for current app, refreshing versions')
            installCompletionRef.current = true
            resetInstallState()
            refreshInstalledVersions().catch(() => undefined)
          }
          return
        }

        installCompletionRef.current = false
        setIsInstalling(true)
      })

      // 监听安装取消事件
      unlistenCancel = await onInstallCancelled((event) => {
        console.info('[useEffect] Install cancelled event received:', event)
        if (event.appId === currentApp?.appId) {
          console.info('[useEffect] Installation cancelled for current app, resetting state')
          installCompletionRef.current = true
          resetInstallState({ immediate: true })
        }
      })

      console.info('[useEffect] Listener setup complete')
    }

    setupListener()

    // 组件卸载时清理监听器
    return () => {
      console.info('[useEffect] Cleaning up listeners')
      if (unlistenProgress) {
        unlistenProgress()
      }
      if (unlistenCancel) {
        unlistenCancel()
      }
      if (progressClearTimerRef.current) {
        clearTimeout(progressClearTimerRef.current)
        progressClearTimerRef.current = null
      }
    }
  }, [currentApp?.appId])

  // 获取最新版本
  const latestVersion = useMemo(() => {
    return versions.length > 0 ? versions[0].version : undefined
  }, [versions])

  // 判断是否安装了最新版本
  const isLatestVersionInstalled = useMemo(() => {
    if (!latestVersion) {
      return false
    }
    return installedVersionSet.has(latestVersion)
  }, [latestVersion, installedVersionSet])

  const hasInstalledVersion = useMemo(() => installedVersionSet.size > 0, [installedVersionSet])

  const refreshInstalledVersions = async(): Promise<Set<string>> => {
    if (!currentApp?.appId) {
      console.info('refreshInstalledVersions: missing appId')
      return new Set()
    }
    try {
      const result = await searchVersions(currentApp.appId)
      const nextSet = new Set(result.map(item => item.version))
      setInstalledVersionSet(nextSet)
      return nextSet
    } catch (err) {
      console.error('refreshInstalledVersions: error', err)
      return installedVersionSet
    }
  }

  const loadVersions = async() => {
    if (!currentApp?.appId) {
      console.info('loadVersions: currentApp.appId is empty')
      return
    }
    setLoading(true)
    try {
      const res = await getSearchAppVersionList({
        appId: currentApp.appId,
        repoName,
        arch,
      })
      const list = [...(res.data || [])]
      list.sort((a, b) => compareVersions(b.version || '', a.version || ''))
      setVersions(list)
    } catch (err) {
      console.error('loadVersions: error', err)
      message.error(`加载版本列表失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }
  const getAppAllInfo = async() => {
    if (!currentApp?.appId) {
      console.info('appAllInfo: currentApp.appId is empty')
      return
    }
    console.info('appAllInfo: getting app detail for', currentApp.appId)
    try {
      const result = await getAppDetail([{ appId: currentApp.appId, arch }])
      const appDetailList = (result.data[currentApp.appId as keyof typeof result.data] as API.APP.AppMainDto[]) || []
      if (appDetailList.length > 0) {
        setScreenshotList(appDetailList[0].appScreenshotList || [])
      } else {
        setScreenshotList([])
      }
    } catch (err) {
      console.error('appAllInfo: error', err)
      message.error(`获取应用详情失败: ${err}`)
    }
  }
  useEffect(() => {
    loadVersions()
    refreshInstalledVersions()
    getAppAllInfo()
  }, [currentApp?.appId, arch, repoName])

  const handleGoBack = () => {
    navigate(-1)
  }

  const handleUninstall = async(version: string) => {
    if (!currentApp?.appId) {
      return
    }

    Modal.confirm({
      title: '确认卸载',
      content: `确定要卸载 ${currentApp.zhName || currentApp.appId} 的版本 ${version} 吗？`,
      onOk: async() => {
        console.info('[handleUninstall] Starting to uninstall:', currentApp.appId, version)
        setUninstallingVersion(version)
        try {
          await uninstallApp(currentApp.appId, version)
          console.info('[handleUninstall] Successfully uninstalled:', currentApp.appId, version)
          message.success('卸载成功')

          const remainingVersions = await refreshInstalledVersions()
          if (remainingVersions.size === 0) {
            removeApp(currentApp.appId, version)
            navigate('/my_apps')
          }
        } catch (error) {
          console.error('[handleUninstall] Error uninstalling:', currentApp.appId, version, error)
          message.error(`卸载失败: ${error}`)
        } finally {
          setUninstallingVersion(null)
        }
      },
    })
  }

  const handleRun = async() => {
    if (!currentApp?.appId) {
      console.info('[handleRun] currentApp.appId is empty')
      return
    }

    console.info('[handleRun] Starting app:', currentApp.appId)

    try {
      // 根据 ll-cli 文档，启动应用只需要 appId，不需要版本号
      await runApp(currentApp.appId)
      message.success('应用启动成功')
    } catch (error) {
      const errorMessage = extractErrorMessage(error)
      console.error('[handleRun] Failed to run app:', errorMessage)
      message.error(`启动失败: ${errorMessage}`)
    }
  }

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

  const isForceInstallHint = (messageText: string) => {
    if (!messageText) {
      return false
    }
    const normalized = messageText.replace(/\s+/g, ' ')
    return normalized.includes('ll-cli install') && normalized.includes('--force')
  }

  const confirmForceInstall = (content: string) => {
    return new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '最新版本已安装',
        content: (
          <div>
            <p>{content}</p>
            <p>是否使用此版本进行替换？</p>
          </div>
        ),
        okText: '替换安装',
        cancelText: '取消',
        centered: true,
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      })
    })
  }

  const runInstall = async(
    version: string | undefined,
    force = false,
    skipDownloadInit = false,
    appInfo?: VersionInfo,
  ) => {
    if (!currentApp?.appId) {
      throw new Error('应用信息不完整')
    }

    installCompletionRef.current = false
    if (progressClearTimerRef.current) {
      clearTimeout(progressClearTimerRef.current)
      progressClearTimerRef.current = null
    }

    if (!skipDownloadInit) {
      const downloadInfo = {
        ...currentApp,
        ...(appInfo || {}),
        version: appInfo?.version ?? version,
      }
      addAppToDownloadList({
        ...downloadInfo,
        flag: 'downloading',
        percentage: 0,
        installStatus: '准备安装...',
      })

      const initialProgress = {
        appId: currentApp.appId,
        progress: '0%',
        percentage: 0,
        status: '准备安装...',
      }
      setInstallProgress(initialProgress)
    }

    await installApp(currentApp.appId, version, force)
  }

  const handleVersionInstall = async(versionInfo: VersionInfo) => {
    if (!versionInfo.version) {
      message.error('缺少版本信息，无法安装')
      return
    }

    setIsInstalling(true)
    setInstallingVersion(versionInfo.version)
    try {
      await runInstall(versionInfo.version, false, false, versionInfo)
      message.success({ content: '安装成功！', key: 'install' })
      await refreshInstalledVersions()
    } catch (error) {
      const errorMessage = extractErrorMessage(error)
      console.error('[handleVersionInstall] 安装失败:', errorMessage)
      if (isForceInstallHint(errorMessage)) {
        const confirmed = await confirmForceInstall(errorMessage)
        if (confirmed) {
          try {
            await runInstall(versionInfo.version, true, true, versionInfo)
            message.success({ content: '安装成功！', key: 'install' })
            await refreshInstalledVersions()
          } catch (forceError) {
            const forceMessage = extractErrorMessage(forceError)
            console.error('[handleVersionInstall] 强制安装失败:', forceMessage)
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
    } finally {
      if (!installCompletionRef.current) {
        resetInstallState({ immediate: true })
      }
    }
  }

  const columns: TableColumnProps<VersionInfo>[] = [
    {
      title: '版本号',
      dataIndex: 'version',
      align: 'center',
    },
    {
      title: '应用类型',
      dataIndex: 'kind',
      align: 'center',
      render: (value: string | undefined) => value || '--',
    },
    {
      title: '通道',
      dataIndex: 'channel',
      align: 'center',
    },
    {
      title: '模式',
      dataIndex: 'module',
      align: 'center',
    },
    {
      title: '仓库来源',
      dataIndex: 'repoName',
      align: 'center',
      render: (value: string | undefined) => value || '--',
    },
    {
      title: '文件大小',
      dataIndex: 'size',
      align: 'center',
      render: (value: string | undefined) => formatFileSize(value),
    },
    {
      title: '下载量',
      dataIndex: 'installCount',
      align: 'center',
      render: (value: number | undefined) => value ?? '--',
    },
    {
      title: '操作',
      dataIndex: 'operate',
      align: 'center',
      render: (_col, record) => {
        const versionInfo = record as VersionInfo
        const versionValue = versionInfo.version || ''
        const isInstalled = versionValue ? installedVersionSet.has(versionValue) : false
        const isUninstalling = uninstallingVersion === versionValue
        const isRowInstalling = installingVersion === versionValue

        if (!versionValue) {
          return '--'
        }

        return (
          <Space>
            {isInstalled ? ([
              <Button
                key={`${versionValue}-run`}
                type='primary'
                size='small'
                onClick={() => handleRun()}
                disabled={isUninstalling}
              >
                启动
              </Button>,
              <Button
                key={`${versionValue}-uninstall`}
                type='primary'
                danger
                size='small'
                onClick={() => handleUninstall(versionValue)}
                loading={isUninstalling}
                disabled={isRowInstalling}
              >
                卸载
              </Button>,
            ]) : (
              <Button
                type='primary'
                size='small'
                onClick={() => handleVersionInstall(versionInfo)}
                loading={isRowInstalling}
                disabled={isUninstalling || isInstalling}
              >
                安装
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  if (!currentApp) {
    return (
      <div className={styles.appDetail}>
        <div className={styles.error}>应用信息加载失败</div>
      </div>
    )
  }
  const handleInstallBtnClick = async() => {
    if (!currentApp?.appId) {
      message.error('应用信息不完整')
      return
    }

    // 如果已安装最新版本，则启动应用
    if (isLatestVersionInstalled && latestVersion) {
      console.info('[handleInstallBtnClick] 启动最新版本:', latestVersion)
      handleRun()
      return
    }

    // 否则安装应用
    setIsInstalling(true)
    try {
      await runInstall(undefined)
      message.success({ content: '安装成功！', key: 'install' })
      await refreshInstalledVersions()
    } catch (error) {
      const errorMessage = extractErrorMessage(error)
      console.error('[handleInstallBtnClick] 安装失败:', errorMessage)
      if (isForceInstallHint(errorMessage)) {
        const confirmed = await confirmForceInstall(errorMessage)
        if (confirmed) {
          try {
            await runInstall(undefined, true, true)
            message.success({ content: '安装成功！', key: 'install' })
            await refreshInstalledVersions()
          } catch (forceError) {
            const forceMessage = extractErrorMessage(forceError)
            console.error('[handleInstallBtnClick] 强制安装失败:', forceMessage)
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
    } finally {
      if (!installCompletionRef.current) {
        resetInstallState({ immediate: true })
      }
    }
  }

  return (
    <div className={styles.appDetail}>
      <div className={styles.ability}>
        <div className={styles.goBack} onClick={handleGoBack}>
          <img src={goBack} alt="back" />
        </div>
        <div className={styles.application}>
          <div className={styles.appLeft}>
            <div className={styles.icon}>
              <img src={currentApp.icon || DefaultIcon} alt={currentApp.zhName || currentApp.appId} />
            </div>
          </div>
          <div className={styles.appRight}>
            <div className={styles.appName}>
              <div className={styles.head}>
                <p className={styles.nameId}>{currentApp.zhName || currentApp.appId}</p>
                <p className={styles.appClass}>{currentApp.kind}</p>
              </div>
              <div className={styles.install}>
                <Button
                  type='primary'
                  shape='round'
                  className={styles.installButton}
                  onClick={handleInstallBtnClick}
                  loading={isInstalling}
                  disabled={isInstalling}
                >
                  {isInstalling ? '安装中...' : (isLatestVersionInstalled ? '启动' : (hasInstalledVersion ? '更新' : '安装'))}
                </Button>
                {isInstalling && installProgress && (
                  <div style={{ marginTop: '12px', width: '100%' }}>
                    <Progress
                      percent={installProgress.percentage}
                      status={installProgress.percentage >= 100 ? 'success' : 'active'}
                      strokeColor={{
                        '0%': '#108ee9',
                        '100%': '#87d068',
                      }}
                    />
                    <div style={{ marginTop: '8px', color: '#666', fontSize: '12px' }}>
                      {installProgress.status} ({installProgress.percentage}%)
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.appDesc}>
              <div className={[styles.modules, styles.separate].join(' ')}>
                <Typography.Text ellipsis>
                  {currentApp.kind || '--'}
                </Typography.Text>
                <Typography.Text ellipsis>
                  应用类型
                </Typography.Text>
              </div>
              <div className={[styles.modules, styles.separate].join(' ')}>
                <Typography.Text ellipsis>
                  {currentApp.channel || '--'}
                </Typography.Text>
                <Typography.Text ellipsis>
                  通道
                </Typography.Text>
              </div>
              <div className={[styles.modules, styles.separate].join(' ')}>
                <Typography.Text ellipsis>
                  {currentApp.version || '--'}
                </Typography.Text>
                <Typography.Text ellipsis>
                  当前版本
                </Typography.Text>
              </div>
              <div className={styles.modules}>
                <Typography.Text ellipsis>
                  {currentApp.appId}
                </Typography.Text>
                <Typography.Text ellipsis>
                  应用ID
                </Typography.Text>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.describe}>
        <div className={styles.title}>应用描述</div>
        <div className={styles.content}>
          {currentApp.description || '暂无描述信息'}
        </div>
      </div>
      {screenshotList.length > 0 ? <div className={styles.screenshot}>
        <div className={styles.title}>屏幕截图</div>
        <div className={styles.imgBox}>
          <div className={styles.imgList}>
            {
              screenshotList.map((item)=>{
                // eslint-disable-next-line react/jsx-key
                return (<Image
                  width={320}
                  height={180}
                  src={item.screenshotKey}
                  alt='应用截图'

                />)
              })
            }
          </div>
        </div>
      </div> : null
      }


      <div className={styles.version}>
        <div className={styles.title}>版本选择</div>
        <div className={styles.content}>
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={versions}
              pagination={false}
              rowKey={(record) => record.version || record.id || `${record.appId}-${record.version}`}
              scroll={{ x: 'max-content' }}
            />
          </Spin>
        </div>
      </div>
    </div>
  )
}

export default AppDetail
