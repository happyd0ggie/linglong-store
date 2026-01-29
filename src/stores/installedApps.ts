/**
 * 已安装应用状态管理模块
 */
import { create } from 'zustand'
import { getInstalledLinglongApps } from '@/apis/invoke'
import { getAppDetails } from '@/apis/apps'
import { message } from 'antd'
/**
 * 创建已安装应用的状态管理store
 * 管理已安装应用列表、需要更新的应用列表、加载状态和错误信息
 */
export const useInstalledAppsStore = create<Store.InstalledApps>((set, get) => ({
  installedApps: [],
  fetchInstalledApps: async(includeBaseService = false) => {
    try {
      // 调用 Tauri 命令获取已安装应用（后端已过滤）
      const apps = await getInstalledLinglongApps(includeBaseService)

      // 更新应用列表
      set({ installedApps: apps })

      // 获取应用详情（图标等）
      await get().updateAppDetails()
    } catch (error) {
      // 错误处理：转换错误信息并更新状态
      message.error('获取已安装应用失败，请重试！')
      console.error('Failed to fetch installed apps:', error)
    }
  },
  updateAppDetails: async() => {
    const { installedApps } = get()

    // 如果没有已安装应用，直接返回
    if (installedApps.length === 0) {
      return
    }

    try {
      // 将已安装应用转换为API请求所需的格式
      const appDetailsVOs: API.APP.AppDetailsVO[] = installedApps.map(app => ({
        appId: app.appId,
        name: app.name,
        version: app.version,
        channel: app.channel,
        module: app.module,
        arch: app.arch,
      }))

      // 调用后端API获取应用详情
      const response = await getAppDetails(appDetailsVOs)

      const detailsData = Array.isArray(response.data) ? response.data : []

      // 转换成Map以便快速查找
      const detailsMap = new Map(detailsData.map(d => [d.appId, d]))

      // 更新应用详情
      const updatedApps = installedApps.map(app => {
        const detail = detailsMap.get(app.appId) || null


        if (detail) {
          return {
            ...app,
            icon: detail.icon || app.icon,
            zhName: detail.zhName || app.zhName,
            categoryName: detail.categoryName || app.categoryName,
            description: detail.description || app.description,
          }
        }

        return app
      })
      set({ installedApps: updatedApps })

    } catch (error) {
      console.error('Failed to update app details:', error)
      // 不阻断流程，只记录错误
      message.error('更新应用详情失败，请重试！')
    }
  },
  removeApp: (appId: string, version: string) => {
    set(state => ({
      // 从已安装列表中移除
      installedApps: state.installedApps.filter(
        app => !(app.appId === appId && app.version === version),
      ),
    }))
  },
  clearApps: () => {
    set({ installedApps: [] })
  },
}))


