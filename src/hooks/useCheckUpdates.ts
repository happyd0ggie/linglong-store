import { useState, useCallback } from 'react'
import { getInstalledLinglongApps, searchRemoteApp } from '@/apis/invoke'
import { compareVersions } from '@/util/checkVersion'

export interface UpdateInfo {
  appId: string;
  name: string;
  version: string; // New version
  currentVersion: string;
  description: string;
  icon: string;
  arch: string;
  categoryName?: string;
}

export const useCheckUpdates = () => {
  const [loading, setLoading] = useState(false)
  const [updates, setUpdates] = useState<UpdateInfo[]>([])

  const checkUpdates = useCallback(async() => {
    setLoading(true)
    setUpdates([])
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
          const validResults = searchResults.filter(item => {
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
                arch: arch,
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

      setUpdates(updateList)
    } catch (error) {
      console.error('Failed to get installed apps:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    updates,
    checkUpdates,
  }
}
