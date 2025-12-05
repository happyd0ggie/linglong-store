import { create } from 'zustand'
import { getInstalledLinglongApps } from '@/apis/invoke'
import { getAppDetail } from '@/apis/apps'
import { compareVersions } from '@/util/checkVersion'
import { useGlobalStore } from './global'

// ==================== 类型定义 ====================

/**
 * 应用更新信息
 */
export interface UpdateInfo {
  /** 应用ID */
  appId: string
  /** 应用名称 */
  name: string
  /** 最新版本 */
  version: string
  /** 当前已安装版本 */
  currentVersion: string
  /** 应用描述 */
  description: string
  /** 应用图标 */
  icon: string
  /** 系统架构 */
  arch: string
  /** 分类名称 */
  categoryName?: string
  /** 中文名称 */
  zhName?: string
}

/**
 * 更新检查 Store 状态接口
 */
interface UpdatesStore {
  /** 可更新的应用列表 */
  updates: UpdateInfo[]
  /** 是否正在检查更新 */
  checking: boolean
  /** 上次检查时间戳 */
  lastChecked: number
  /** 检查更新 */
  checkUpdates: (force?: boolean) => Promise<void>
  /** 启动自动刷新 */
  startAutoRefresh: () => void
  /** 停止自动刷新 */
  stopAutoRefresh: () => void
  /** 移除指定应用的更新记录 */
  removeUpdate: (appId: string) => void
}

// ==================== 常量配置 ====================

/** 自动刷新间隔（1小时） */
const AUTO_REFRESH_INTERVAL = 60 * 60 * 1000

/** 定时器引用 */
let autoRefreshTimer: NodeJS.Timeout | null = null

// ==================== 辅助函数 ====================

/**
 * 构建批量查询参数
 * @param installedApps 已安装的应用列表
 * @param arch 系统架构
 * @returns 查询参数数组
 */
function buildAppDetailSearchParams(
  installedApps: API.INVOKE.InstalledApp[],
  arch: string,
): API.APP.AppDetailSearchBO[] {
  return installedApps
    .filter(app => app.module !== 'devel')
    .map(app => ({
      appId: app.appId,
      arch,
    }))
}

/**
 * 从远程版本列表中查找最新版本
 * @param versions 版本列表（已按版本号降序排列）
 * @returns 最新版本信息，如果列表为空则返回 null
 */
function getLatestVersion(versions: API.APP.AppMainDto[]): API.APP.AppMainDto | null {
  // 过滤掉 devel 模块，取第一个作为最新版本
  const nonDevelVersions = versions.filter(v => v.module !== 'devel')
  return nonDevelVersions.length > 0 ? nonDevelVersions[0] : null
}

/**
 * 比较并生成更新信息
 * @param installedApp 已安装的应用
 * @param latestVersion 远程最新版本
 * @returns 更新信息，如果无需更新则返回 null
 */
function buildUpdateInfo(
  installedApp: API.INVOKE.InstalledApp,
  latestVersion: API.APP.AppMainDto,
): UpdateInfo | null {
  const latestVersionStr = latestVersion.version || ''
  const currentVersionStr = installedApp.version

  // 版本比较：最新版本 > 当前版本 才需要更新
  if (compareVersions(latestVersionStr, currentVersionStr) !== 1) {
    return null
  }

  return {
    appId: installedApp.appId,
    name: latestVersion.name || installedApp.name,
    version: latestVersionStr,
    currentVersion: currentVersionStr,
    description: latestVersion.description || installedApp.description || '',
    icon: latestVersion.icon || installedApp.icon,
    arch: latestVersion.arch || installedApp.arch,
    categoryName: latestVersion.categoryName || installedApp.categoryName,
    zhName: latestVersion.zhName || installedApp.zhName,
  }
}

/**
 * 处理远程版本数据，生成更新列表
 * @param installedApps 已安装的应用列表
 * @param remoteData 远程版本数据 Map
 * @returns 需要更新的应用列表
 */
function processRemoteVersions(
  installedApps: API.INVOKE.InstalledApp[],
  remoteData: Record<string, API.APP.AppMainDto[]>,
): UpdateInfo[] {
  const updateList: UpdateInfo[] = []

  for (const installedApp of installedApps) {
    // 跳过 devel 模块的应用
    if (installedApp.module === 'devel') {
      continue
    }

    const versions = remoteData[installedApp.appId]
    if (!versions || versions.length === 0) {
      continue
    }

    const latestVersion = getLatestVersion(versions)
    if (!latestVersion) {
      continue
    }

    const updateInfo = buildUpdateInfo(installedApp, latestVersion)
    if (updateInfo) {
      updateList.push(updateInfo)
    }
  }

  return updateList
}

// ==================== Store 定义 ====================

export const useUpdatesStore = create<UpdatesStore>((set, get) => ({
  updates: [],
  checking: false,
  lastChecked: 0,

  /**
   * 检查应用更新
   * 通过批量查询接口获取远程版本信息，与本地版本对比生成更新列表
   * @param force 是否强制检查（忽略正在进行的检查）
   */
  checkUpdates: async(force = false) => {
    const { checking } = get()

    // 防止重复检查
    if (checking && !force) {
      return
    }

    set({ checking: true })

    try {
      // 1. 获取已安装的应用列表
      const installedApps = await getInstalledLinglongApps()
      if (installedApps.length === 0) {
        set({ updates: [], lastChecked: Date.now() })
        useGlobalStore.getState().getUpdateAppNum(0)
        return
      }

      // 2. 获取系统架构
      const arch = useGlobalStore.getState().arch
      if (!arch) {
        console.warn('[checkUpdates] System arch not available')
        return
      }

      // 3. 构建批量查询参数
      const searchParams = buildAppDetailSearchParams(installedApps, arch)
      if (searchParams.length === 0) {
        set({ updates: [], lastChecked: Date.now() })
        useGlobalStore.getState().getUpdateAppNum(0)
        return
      }

      // 4. 批量查询远程版本信息
      const response = await getAppDetail(searchParams)
      if (!response.data) {
        console.warn('[checkUpdates] No data returned from getAppDetail')
        set({ updates: [], lastChecked: Date.now() })
        useGlobalStore.getState().getUpdateAppNum(0)
        return
      }

      // 5. 处理远程数据，生成更新列表
      const updateList = processRemoteVersions(installedApps, response.data)

      // 6. 更新状态
      set({ updates: updateList, lastChecked: Date.now() })
      useGlobalStore.getState().getUpdateAppNum(updateList.length)

    } catch (error) {
      console.error('[checkUpdates] Failed to check updates:', error)
    } finally {
      set({ checking: false })
    }
  },

  /**
   * 启动自动刷新
   * 立即执行一次检查，然后每小时自动检查一次
   */
  startAutoRefresh: () => {
    if (autoRefreshTimer) {
      return
    }

    // 立即检查一次
    get().checkUpdates()

    // 设置定时刷新
    autoRefreshTimer = setInterval(() => {
      get().checkUpdates()
    }, AUTO_REFRESH_INTERVAL)
  },

  /**
   * 停止自动刷新
   */
  stopAutoRefresh: () => {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer)
      autoRefreshTimer = null
    }
  },

  /**
   * 移除指定应用的更新记录
   * 通常在应用更新完成后调用
   * @param appId 应用ID
   */
  removeUpdate: (appId: string) => {
    set(state => {
      const nextUpdates = state.updates.filter(item => item.appId !== appId)
      useGlobalStore.getState().getUpdateAppNum(nextUpdates.length)
      return { updates: nextUpdates }
    })
  },
}))
