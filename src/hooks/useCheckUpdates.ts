import { useUpdatesStore, type UpdateInfo } from '@/stores/updates'

export type { UpdateInfo }

export const useCheckUpdates = () => {
  const updates = useUpdatesStore(state => state.updates)
  const loading = useUpdatesStore(state => state.checking)
  const checkUpdates = useUpdatesStore(state => state.checkUpdates)

  return {
    loading,
    updates,
    checkUpdates,
  }
}
