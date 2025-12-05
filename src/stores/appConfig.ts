/**
 * 应用配置状态管理模块
 * 使用 Zustand 管理全局配置，并通过 @tauri-store/zustand 实现配置持久化
 */
import { create } from 'zustand'
import { createTauriStore } from '@tauri-store/zustand'

/**
 * 创建应用配置状态管理store
 * 管理更新检查和基础服务显示等全局配置
 */
export const useConfigStore = create<Store.Config>((set) => ({
  /** 是否启用版本检查功能的标志 */
  checkVersion: false,
  /** 是否显示基础服务应用的标志 */
  showBaseService: false,

  /** 点击关闭时是直接关闭还是最小化到托盘 */
  closeOrHide: 'hide',
  /**
   * 更改版本检查功能的状态
   * @param value - 新的版本检查状态
   */
  changeCheckVersionStatus: (value: boolean) => set((_state) => ({
    checkVersion: value,
  })),

  /**
   * 更改基础服务显示状态
   * @param value - 新的基础服务显示状态
   */
  changeBaseServiceStatus: (value: boolean) => set((_state) => ({
    showBaseService: value,
  })),
  /** 更改点击关闭时记录的状态 */

  changeCloseOrHide: (value: string) => set((_state) => ({
    closeOrHide: value,
  })),
}))

/**
 * @deprecated 此 Store 已被 InstallQueueStore 替代，请使用 useInstallQueueStore
 * @see src/stores/installQueue.ts
 *
 * 保留此代码仅用于兼容性，将在后续版本移除
 */
export const useDownloadConfigStore = create<Store.DownloadConfig>((set) => ({
  // 下载应用保存列表
  downloadList: [],
  // 追加app到下载列表
  addAppToDownloadList: (app: API.APP.AppMainDto | Store.DownloadApp) => set((state) => {
    // 检查是否已存在该应用
    const existingIndex = state.downloadList.findIndex(item => item.appId === app.appId)

    if (existingIndex !== -1) {
      // 如果已存在，更新该应用的信息
      const newList = [...state.downloadList]
      newList[existingIndex] = { ...(app as API.APP.AppMainDto), flag: 'downloading' }
      return { downloadList: newList }
    }

    // 如果不存在，追加到列表
    return {
      downloadList: [...state.downloadList, { ...(app as API.APP.AppMainDto), flag: 'downloading' }],
    }
  }),
  // 改变APP下载状态(已下载和下载中)
  changeAppDownloadStatus: (appId: string, status = 'downloaded') => set((state) => ({
    downloadList: state.downloadList.map((app: Store.DownloadApp) => {
      if (app.appId === appId) {
        // 返回新的对象以保持不可变性
        return { ...app, flag: status }
      }
      return app
    }),

  })),
  // 更新APP安装进度
  updateAppProgress: (appId: string, percentage: number, status: string) => set((state) => {
    return {
      downloadList: state.downloadList.map((app: Store.DownloadApp) => {
        if (app.appId === appId) {
          return {
            ...app,
            percentage,
            installStatus: status,
            // 如果达到100%，将状态改为已下载
            flag: percentage >= 100 ? 'downloaded' : 'downloading',
          }
        }
        return app
      }),
    }
  }),
  // 清空下载列表
  clearDownloadList: () => set((state) => ({
    downloadList: state.downloadList.filter((app: Store.DownloadApp) => app.flag === 'downloading'),
  })),
  // 移除下载中的应用
  removeDownloadingApp: (appId: string) => set((state) => ({
    downloadList: state.downloadList.filter((app: Store.DownloadApp) => app.appId !== appId),
  })),
}))

/**
 * 全局应用配置的持久化存储实例
 * 使用 @tauri-store/zustand 将配置保存到本地磁盘
 * @param saveOnChange - 配置变更时自动保存
 * @param autoStart - 应用启动时自动初始化
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tauriAppConfigHandler = createTauriStore('ConfigStore', useConfigStore as any, {
  saveOnChange: true, // 配置变更时自动保存到磁盘
  autoStart: true, // 应用启动时自动从磁盘加载配置
})

/**
 * @deprecated 此持久化处理器已被废弃
 * 新的安装任务持久化通过 InstallQueueStore.persistCurrentTask 实现
 * @see src/stores/installQueue.ts
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tauriDownloadConfigHandler = createTauriStore('downloadConfigStore', useDownloadConfigStore as any, {
  saveOnChange: true, // 配置变更时自动保存到磁盘
  autoStart: false, // 禁用自动启动，我们手动加载并过滤
})

/**
 * @deprecated 下载列表过滤逻辑已被废弃
 * 新的崩溃恢复机制通过 InstallQueueStore.checkRecovery 实现
 */
// 手动启动并过滤掉 downloading 状态的残留数据
tauriDownloadConfigHandler.start().then(() => {
  const state = useDownloadConfigStore.getState()
  const originalCount = state.downloadList.length

  // 过滤掉正在下载中的残留数据
  const filteredList = state.downloadList.filter((app: Store.DownloadApp) => app.flag !== 'downloading')

  if (filteredList.length < originalCount) {
    useDownloadConfigStore.setState({ downloadList: filteredList })
  }
})
