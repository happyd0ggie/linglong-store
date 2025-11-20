import { create } from 'zustand'
import { getInstalledLinglongApps, searchRemoteApp } from '@/apis/invoke'
import { getAppDetails } from '@/apis/apps'
import { compareVersions } from '@/util/checkVersion'
import { useGlobalStore } from './global'

export interface UpdateInfo {
  appId: string
  name: string
  version: string // New version
  currentVersion: string
  description: string
  icon: string
  arch: string
  categoryName?: string
  zhName?: string
}

interface UpdatesStore {
  updates: UpdateInfo[]
  checking: boolean
  lastChecked: number
  checkUpdates: (force?: boolean) => Promise<void>
  startAutoRefresh: () => void
  stopAutoRefresh: () => void
}

let timer: NodeJS.Timeout | null = null

export const useUpdatesStore = create<UpdatesStore>((set, get) => ({
  updates: [],
  checking: false,
  lastChecked: 0,

  checkUpdates: async(force = false) => {
    const { checking } = get()

    if (checking && !force) {
      return
    }

    set({ checking: true })

    try {
      const installedApps = await getInstalledLinglongApps()

      // 并行检查更新
      const checkPromises = installedApps.map(async(app) => {
        if (app.module === 'devel') {
          return null
        }

        try {
          const searchResults = await searchRemoteApp(app.appId)

          // 过滤出相同 appId 且非 devel 的版本
          const validResults = searchResults.filter((item) => {
            const itemId = item.appId || item.name
            return itemId === app.appId && item.module !== 'devel'
          })

          if (validResults.length > 0) {
            // 按版本号降序排序
            validResults.sort((a, b) => compareVersions(b.version, a.version))

            const latest = validResults[0]
            // 如果最新版本大于当前版本
            if (compareVersions(latest.version, app.version) === 1) {
              let arch = ''
              if (typeof latest.arch === 'string') {
                arch = latest.arch
              } else if (Array.isArray(latest.arch) && latest.arch.length > 0) {
                arch = latest.arch[0]
              }

              return {
                appId: app.appId,
                name: latest.name,
                version: latest.version,
                currentVersion: app.version,
                description: latest.description || '',
                icon: app.icon, // 使用本地图标或后续获取
                arch,
                categoryName: app.categoryName,
              } as UpdateInfo
            }
          }
        } catch (err) {
          console.error(`Failed to check update for ${app.appId}:`, err)
        }
        return null
      })

      const results = await Promise.all(checkPromises)
      const updateList = results.filter((item): item is UpdateInfo => item !== null)

      // Fetch rich details (icons, zhName) from backend
      if (updateList.length > 0) {
        try {
          const appDetailsVOs = updateList.map((info) => {
            const originalApp = installedApps.find(a => a.appId === info.appId)
            return {
              appId: info.appId,
              name: info.name,
              version: info.version,
              channel: originalApp?.channel || '',
              module: originalApp?.module || '',
              arch: info.arch,
            }
          })

          const res = await getAppDetails(appDetailsVOs)
          if (res.data && Array.isArray(res.data)) {
            res.data.forEach((detail) => {
              const target = updateList.find(u => u.appId === detail.appId)
              if (target) {
                if (detail.icon) {
                  target.icon = detail.icon
                }
                if (detail.description) {
                  target.description = detail.description
                }
                if (detail.zhName) {
                  target.zhName = detail.zhName
                }
              }
            })
          }
        } catch (e) {
          console.error('Failed to fetch app details for updates:', e)
        }
      }

      set({ updates: updateList, lastChecked: Date.now() })

      // 更新全局状态中的更新数量
      useGlobalStore.getState().getUpdateAppNum(updateList.length)

    } catch (error) {
      console.error('Failed to check updates:', error)
    } finally {
      set({ checking: false })
    }
  },

  startAutoRefresh: () => {
    if (timer) {
      return
    }
    // 立即检查
    get().checkUpdates()
    // 每小时检查一次
    timer = setInterval(() => {
      get().checkUpdates()
    }, 60 * 60 * 1000)
  },

  stopAutoRefresh: () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  },
}))
