/**
 * 应用布局组件
 * 包含标题栏、侧边栏和主内容区域
 * 负责应用初始化和主界面布局
 */

import styles from './index.module.scss'
import { Outlet } from 'react-router-dom'
import { Suspense, useEffect, useState, useCallback } from 'react'
import Titlebar from './titlebar'
import Sidebar from './sidebar'
import LaunchPage from './launchPage'
import Loading from '../components/Loading'
import AnalyticsConsentDialog from '@/components/AnalyticsConsentDialog'

import { useGlobalStore } from '@/stores/global'
import { useUpdatesStore } from '@/stores/updates'
import { useConfigStore } from '@/stores/appConfig'
import { useInstalledAppsStore } from '@/stores/installedApps'
import { sendVisitRecord } from '@/services/analyticsService'
// import { arch } from '@tauri-apps/plugin-os'

// 暂时注释的 Antd Layout 组件，可能用于未来的布局重构
// import { Layout } from 'antd'
// const { Header, Sider, Content } = Layout

/**
 * 主应用布局组件
 * 管理应用的初始化状态和主要布局结构
 */
const AppLayout = () => {
  const { isInited } = useGlobalStore()
  const startAutoRefresh = useUpdatesStore(state => state.startAutoRefresh)
  const stopAutoRefresh = useUpdatesStore(state => state.stopAutoRefresh)
  const allowAnalytics = useConfigStore(state => state.allowAnalytics)

  // 匿名统计确认弹窗状态
  const [showAnalyticsConsent, setShowAnalyticsConsent] = useState(false)

  // 当初始化完成且用户尚未选择统计选项时，显示确认弹窗
  useEffect(() => {
    if (isInited && allowAnalytics === undefined) {
      setShowAnalyticsConsent(true)
    }
  }, [isInited, allowAnalytics])

  // 当初始化完成且用户已允许统计时，自动发送访问记录
  useEffect(() => {
    if (isInited && allowAnalytics === true) {
      sendVisitRecord().catch((err) => console.warn('[AppLayout] Auto sendVisitRecord failed', err))
    }
  }, [isInited, allowAnalytics])

  // 处理匿名统计确认弹窗的用户选择
  const handleAnalyticsConsentComplete = useCallback((allowed: boolean) => {
    setShowAnalyticsConsent(false)
    if (allowed) {
      // 用户同意，发送访问记录
      sendVisitRecord().catch((err) => console.warn('[AppLayout] sendVisitRecord failed', err))
    }
    console.info('[AppLayout] Analytics consent:', allowed ? 'allowed' : 'denied')
  }, [])

  useEffect(() => {
    startAutoRefresh()
    return () => {
      stopAutoRefresh()
    }
  }, [startAutoRefresh, stopAutoRefresh])
  // // 从全局状态store中获取初始化相关方法
  // const onInited = useGlobalStore((state) => state.onInited)
  // const getUpdateAppNum = useGlobalStore((state) => state.getUpdateAppNum)
  // const changeArch = useGlobalStore((state) => state.setArch)


  /** 从已安装应用store中获取更新和加载方法 */
  const {
    fetchInstalledApps,
  } = useInstalledAppsStore()

  /** 从配置store中获取是否显示基础服务的设置 */
  const { showBaseService } = useConfigStore()

  /** 监听基础服务显示配置变化，重新加载应用列表 */
  useEffect(() => {
    fetchInstalledApps(showBaseService)
  }, [showBaseService, fetchInstalledApps])

  // /**
  //  * 应用初始化效果
  //  * 1. 获取并设置系统架构
  //  * 2. 完成初始化配置
  //  * 3. 统计需要更新的应用数量
  //  */
  // useEffect(() => {
  //   const currentArch = arch()
  //   changeArch(currentArch)
  //   setIsInit(true) // 修复: 初始化完成后应该设置为 true
  //   onInited()
  //   getUpdateAppNum(needUpdateApps.length || 0)
  // }, [])

  /**
   * 渲染应用布局
   * 初始化时显示启动页面
   * 初始化完成后显示主布局（包含侧边栏和内容区）
   */
  return (
    <div className={styles.layout}>
      {/* 标题栏组件，始终显示 */}
      <Titlebar showSearch={isInited} showDownload={isInited} />
      {
        // 根据初始化状态决定显示启动页还是主布局
        isInited ? <div className={styles.layoutContent}>
          {/* 侧边栏导航 */}
          <Sidebar className={styles.sider} />
          {/* 主内容区域，使用 Suspense 处理异步加载 */}
          <div className={styles.content}>
            <Suspense fallback={<Loading />}>
              <Outlet />
            </Suspense>
          </div>
        </div> : <LaunchPage />
      }
      {/* 匿名统计确认弹窗 - 放在布局层确保初始化完成后也能显示 */}
      <AnalyticsConsentDialog
        visible={showAnalyticsConsent}
        onComplete={handleAnalyticsConsentComplete}
      />
    </div>
  )
  // 备选的 Antd Layout 布局方案
  // return (
  //   <Layout>
  //     <Header>
  //       <Titlebar/>
  //     </Header>
  //     <Layout>
  //       <Sider>
  //         <Sidebar className={styles.sider} />
  //       </Sider>
  //       <Content className={styles.content}>
  //         <Suspense fallback={<Loading />}>
  //           <Outlet />
  //         </Suspense>
  //       </Content>
  //     </Layout>
  //   </Layout>
  // )
}

export default AppLayout
