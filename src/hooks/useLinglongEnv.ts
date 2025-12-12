import { useCallback } from 'react'
import { message } from 'antd'
import { findShellString } from '@/apis/apps'
import { checkLinglongEnv, installLinglongEnv } from '@/apis/invoke'
import { useEnvStore } from '@/stores/env'
import { useGlobalStore } from '@/stores/global'

const DEFAULT_REASON = '检测到系统未安装玲珑环境，请先安装'

export const useLinglongEnv = () => {
  // 直接从 store 获取 setter 函数，避免使用 selector 返回对象导致无限循环
  // setter 函数是稳定的，不需要响应式订阅
  const setChecking = useEnvStore.getState().setChecking
  const setInstalling = useEnvStore.getState().setInstalling
  const setReason = useEnvStore.getState().setReason
  const setEnvReady = useEnvStore.getState().setEnvReady
  const setEnvInfo = useEnvStore.getState().setEnvInfo
  const setArch = useGlobalStore.getState().setArch
  const setRepoName = useGlobalStore.getState().setRepoName

  const runCheck = useCallback(async(): Promise<API.INVOKE.LinglongEnvCheckResult> => {
    setChecking(true)
    try {
      const res = await checkLinglongEnv()
      console.info('[useLinglongEnv] checkEnv result', res)
      setEnvInfo({
        arch: res.arch || '',
        osVersion: res.osVersion || '',
        detailMsg: res.detailMsg || '',
        llVersion: res.llVersion || '',
        llBinVersion: res.llBinVersion || '',
        repoName: res.repoName || 'stable',
        repos: res.repos || [],
        envReady: res.ok,
        reason: res.reason,
      })
      if (res.arch) {
        setArch(res.arch)
      }
      if (res.repoName) {
        setRepoName(res.repoName)
      }
      setEnvReady(res.ok)
      setReason(res.ok ? undefined : (res.reason || DEFAULT_REASON))
      return res
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.warn('[useLinglongEnv] checkEnv error', errMsg)
      setReason(errMsg)
      setEnvInfo({
        envReady: false,
        reason: errMsg,
        repoName: 'stable',
        repos: [],
        llVersion: '',
        llBinVersion: '',
        osVersion: '',
        arch: '',
      })
      setEnvReady(false)
      throw error
    } finally {
      setChecking(false)
    }
  }, [])

  const runInstall = useCallback(async(): Promise<API.INVOKE.InstallLinglongResult> => {
    setInstalling(true)
    const hide = message.loading({ content: '正在自动安装玲珑环境...', key: 'install-linglong', duration: 0 })
    try {
      const res = await findShellString()
      const shellString = res.data
      if (res.code !== 200 || !shellString) {
        throw new Error('获取安装脚本失败，请稍后重试')
      }
      const output = await installLinglongEnv(shellString)
      hide()
      message.success({ content: '玲珑环境安装完成，正在重新检测...', key: 'install-linglong' })
      console.info('[useLinglongEnv] installEnv success', output)
      return output
    } catch (error) {
      hide()
      const errMsg = error instanceof Error ? error.message : String(error)
      message.error({ content: errMsg, key: 'install-linglong' })
      setReason(errMsg)
      console.warn('[useLinglongEnv] installEnv error', errMsg)
      throw error
    } finally {
      setInstalling(false)
    }
  }, [])

  return {
    checkEnv: runCheck,
    installEnv: runInstall,
  }
}
