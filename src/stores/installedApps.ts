/**
 * 已安装应用状态管理模块
 */
import { create } from 'zustand'
import { getInstalledLinglongApps, getAllInstalledLinglongApps } from '@/apis/invoke'
import { getAppDetails } from '@/apis/apps'
import { message } from 'antd'

/**
 * 创建已安装应用的状态管理store
 * 管理已安装应用列表、需要更新的应用列表、加载状态和错误信息
 */
export const useInstalledAppsStore = create<Store.InstalledApps>((set, get) => ({
  installedApps: [],
  needUpdateApps: [],
  fetchInstalledApps: async(includeBaseService = false) => {
    try {
      // 调用 Tauri 命令获取已安装应用（后端已过滤）
      const apps = includeBaseService
        ? await getAllInstalledLinglongApps()
        : await getInstalledLinglongApps()

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

      // 更新应用详情
      const updatedApps = installedApps.map(app => {
        const detail = detailsData.find(
          (d) => d.appId === app.appId && d.name === app.name && d.version === app.version,
        )

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
      // 计算需要更新的应用（same appId，detail.version > installed version）
      // 需要更新的应用列表
      const needUpdateApps = installedApps.filter(app => {
        const detail = detailsData.find(d => d.appId === app.appId)

        if (!detail || !detail.version) {
          return false
        }
        // 如果 detail.version 比已安装的 app.version 新，则视为需要更新
        return compareVersions(detail.version, app.version) > 0
      })

      // console.log(needUpdateApps, 'detail for update check')
      // 保存需要更新的应用列表到 store（用于 UI 提示/批量更新等）
      set({ needUpdateApps: needUpdateApps })
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
      // 从需要更新列表中移除
      needUpdateApps: state.installedApps.filter(
        app => !(app.appId === appId && app.version === version),
      ),
    }))
  },
  clearApps: () => {
    set({ installedApps: [] })
  },
}))

/**
 * 比较两个版本号
 * @param v1 - 第一个版本号
 * @param v2 - 第二个版本号
 * @returns 比较结果：1(v1>v2), -1(v1<v2), 0(v1=v2)
 */
const compareVersions = (v1: string, v2: string): number => {
  // 将版本号分割为数字和字符串部分
  const a = String(v1).split(/[._-]/).map(s => (s === '' ? 0 : (Number.isNaN(Number(s)) ? s : Number(s))))
  const b = String(v2).split(/[._-]/).map(s => (s === '' ? 0 : (Number.isNaN(Number(s)) ? s : Number(s))))
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    // 使用类型 string | number 替代 any
    const aa: string | number = a[i] ?? 0
    const bb: string | number = b[i] ?? 0
    if (typeof aa === 'number' && typeof bb === 'number') {
      if (aa > bb) {
        return 1
      }
      if (aa < bb) {
        return -1
      }
    } else {
      const sa = String(aa)
      const sb = String(bb)
      if (sa > sb) {
        return 1
      }
      if (sa < sb) {
        return -1
      }
    }
  }
  return 0
}
