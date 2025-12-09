import { useMemo } from 'react'
import { useUpdatesStore } from '@/stores/updates'

/**
 * 侧边栏菜单徽标计数
 * 按 menuPath 返回红点数量；未配置的菜单默认 0
 */
export const useMenuBadges = (): Record<string, number> => {
  const updateCount = useUpdatesStore(state => state.updates.length)

  return useMemo(() => ({
    '/update_apps': updateCount,
  }), [updateCount])
}
