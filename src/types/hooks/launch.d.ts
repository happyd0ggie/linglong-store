declare namespace Hooks {
  namespace Launch {
    /** 更新信息接口 */
    interface UpdateInfo {
      /** 最新版本号 */
      version: string
      /** DEB 包下载链接 (amd64) */
      debUrl: string
      /** RPM 包下载链接 (x86_64) */
      rpmUrl: string
      /** AppImage 包下载链接 (通用) */
      appImageUrl?: string
      /** 更新日志 */
      changelog: string
      /** 发布时间 */
      publishedAt: string
    }

    /** 应用启动钩子返回的类型 */
    interface UseLaunchReturn {
      /** 应用是否初始化完成 */
      isInit: boolean
      /** 玲珑环境是否已准备就绪 */
      envReady: boolean
      /** 是否已经完成环境检测 */
      envChecked: boolean
      /** 初始化进度（0-100） */
      progress: number
      /** 当前初始化步骤描述 */
      currentStep: string
      /** 初始化错误信息 */
      error: string | null
      /** 重新初始化方法 */
      retry: () => Promise<void>
      /** 是否正在检查更新 */
      checkingUpdate: boolean
      /** 是否有可用更新 */
      hasUpdate: boolean
      /** 更新信息 */
      updateInfo: UpdateInfo | null
    }
  }
}
