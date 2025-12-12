import { create } from 'zustand'

const defaultState = {
  checking: false,
  installing: false,
  checked: false,
  envReady: false,
  reason: undefined as string | undefined,
  osVersion: '',
  arch: '',
  llVersion: '',
  llBinVersion: '',
  repoName: 'stable',
  detailMsg: '',
  repos: [] as API.INVOKE.LinglongRepo[],
}

const shallowEqual = (a: Partial<Store.Env>, b: Partial<Store.Env>) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    // @ts-expect-error dynamic compare
    if (a[key] !== b[key]) {
      return false
    }
  }
  return true
}

export const useEnvStore = create<Store.Env>((set) => ({
  ...defaultState,
  setChecking: (value: boolean) => set(() => ({ checking: value })),
  setInstalling: (value: boolean) => set(() => ({ installing: value })),
  setReason: (value?: string) => set(() => ({ reason: value })),
  setEnvReady: (value: boolean) => set(() => ({ envReady: value })),
  setEnvInfo: (value: Partial<Store.Env>) => set((state) => {
    const next = {
      ...state,
      ...value,
      checked: true,
    } as Store.Env
    if (shallowEqual(state, next)) {
      return state
    }
    console.info('[env] setEnvInfo', value)
    return next
  }),
}))
