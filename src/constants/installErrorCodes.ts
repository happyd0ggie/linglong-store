/**
 * 安装错误码映射表
 *
 * 基于 linglong::utils::error::ErrorCode 定义
 * 来源：libs/utils/src/linglong/utils/error/error.h
 *
 * 用于将后端返回的错误码映射为用户友好的中文提示
 */

/**
 * 错误码枚举
 * 与后端 ErrorCode 保持一致
 */
export enum InstallErrorCode {
  // 通用错误
  Failed = -1,
  Success = 0,
  Cancelled = 1,
  Unknown = 1000,
  AppNotFoundFromRemote = 1001,
  AppNotFoundFromLocal = 1002,

  // 安装相关错误 (2001-2011)
  AppInstallFailed = 2001,
  AppInstallNotFoundFromRemote = 2002,
  AppInstallAlreadyInstalled = 2003,
  AppInstallNeedDowngrade = 2004,
  AppInstallModuleNoVersion = 2005,
  AppInstallModuleRequireAppFirst = 2006,
  AppInstallModuleAlreadyExists = 2007,
  AppInstallArchNotMatch = 2008,
  AppInstallModuleNotFound = 2009,
  AppInstallErofsNotFound = 2010,
  AppInstallUnsupportedFileFormat = 2011,

  // 卸载相关错误 (2101-2106)
  AppUninstallFailed = 2101,
  AppUninstallNotFoundFromLocal = 2102,
  AppUninstallAppIsRunning = 2103,
  LayerCompatibilityError = 2104,
  AppUninstallMultipleVersions = 2105,
  AppUninstallBaseOrRuntime = 2106,

  // 升级相关错误 (2201-2202)
  AppUpgradeFailed = 2201,
  AppUpgradeLocalNotFound = 2202,

  // 网络错误 (3001)
  NetworkError = 3001,

  // 解析/平台错误 (4001-4002)
  InvalidFuzzyReference = 4001,
  UnknownArchitecture = 4002,

  // 自定义错误码（前端/GUI 专用）
  ProgressTimeout = -2, // 进度超时
}

/**
 * 错误码到用户友好消息的映射
 */
export const installErrorCodeMessages: Record<number, string> = {
  // 通用
  [InstallErrorCode.Failed]: '通用失败',
  [InstallErrorCode.Success]: '成功',
  [InstallErrorCode.Cancelled]: '操作已取消',
  [InstallErrorCode.Unknown]: '未知错误',
  [InstallErrorCode.AppNotFoundFromRemote]: '远程仓库找不到应用',
  [InstallErrorCode.AppNotFoundFromLocal]: '本地找不到应用',

  // 安装
  [InstallErrorCode.AppInstallFailed]: '安装失败',
  [InstallErrorCode.AppInstallNotFoundFromRemote]: '远程无该应用',
  [InstallErrorCode.AppInstallAlreadyInstalled]: '已安装同版本',
  [InstallErrorCode.AppInstallNeedDowngrade]: '需要降级安装',
  [InstallErrorCode.AppInstallModuleNoVersion]: '安装模块时不允许指定版本',
  [InstallErrorCode.AppInstallModuleRequireAppFirst]: '安装模块需先安装应用',
  [InstallErrorCode.AppInstallModuleAlreadyExists]: '模块已存在',
  [InstallErrorCode.AppInstallArchNotMatch]: '架构不匹配',
  [InstallErrorCode.AppInstallModuleNotFound]: '远程无该模块',
  [InstallErrorCode.AppInstallErofsNotFound]: '缺少 erofs 解压命令',
  [InstallErrorCode.AppInstallUnsupportedFileFormat]: '不支持的文件格式',

  // 卸载
  [InstallErrorCode.AppUninstallFailed]: '卸载失败',
  [InstallErrorCode.AppUninstallNotFoundFromLocal]: '本地无该应用',
  [InstallErrorCode.AppUninstallAppIsRunning]: '应用正在运行',
  [InstallErrorCode.LayerCompatibilityError]: '找不到兼容 layer',
  [InstallErrorCode.AppUninstallMultipleVersions]: '存在多版本',
  [InstallErrorCode.AppUninstallBaseOrRuntime]: 'base/runtime 不允许卸载',

  // 升级
  [InstallErrorCode.AppUpgradeFailed]: '升级失败',
  [InstallErrorCode.AppUpgradeLocalNotFound]: '本地无可升级应用',

  // 网络
  [InstallErrorCode.NetworkError]: '网络错误',

  // 解析/平台
  [InstallErrorCode.InvalidFuzzyReference]: '无效引用',
  [InstallErrorCode.UnknownArchitecture]: '未知架构',

  // 自定义
  [InstallErrorCode.ProgressTimeout]: '进度超时',
}

/**
 * 根据错误码获取用户友好的错误消息
 * @param code 错误码
 * @param fallbackMessage 兜底消息（当错误码未映射时使用）
 * @returns 用户友好的错误消息
 */
export function getInstallErrorMessage(code: number | undefined, fallbackMessage?: string): string {
  if (code === undefined || code === null) {
    return fallbackMessage || '未知错误'
  }

  const mappedMessage = installErrorCodeMessages[code]
  if (mappedMessage) {
    return mappedMessage
  }

  // 未映射的错误码，使用兜底消息或显示错误码
  return fallbackMessage || `错误码: ${code}`
}

/**
 * 判断错误码是否表示需要用户操作的错误
 * @param code 错误码
 * @returns 是否需要用户操作
 */
export function isUserActionRequired(code: number | undefined): boolean {
  if (code === undefined || code === null) {
    return false
  }

  // 需要用户操作的错误码
  const userActionCodes = [
    InstallErrorCode.AppInstallNeedDowngrade, // 需要降级
    InstallErrorCode.AppInstallAlreadyInstalled, // 已安装，可能需要强制安装
    InstallErrorCode.AppUninstallAppIsRunning, // 需要先停止应用
    InstallErrorCode.AppInstallArchNotMatch, // 架构不匹配，需要选择其他版本
    InstallErrorCode.NetworkError, // 网络错误，可重试
  ]

  return userActionCodes.includes(code)
}

/**
 * 判断错误是否可重试
 * @param code 错误码
 * @returns 是否可重试
 */
export function isRetryableError(code: number | undefined): boolean {
  if (code === undefined || code === null) {
    return false
  }

  // 可重试的错误码
  const retryableCodes = [
    InstallErrorCode.NetworkError,
    InstallErrorCode.ProgressTimeout,
    InstallErrorCode.Unknown,
  ]

  return retryableCodes.includes(code)
}
