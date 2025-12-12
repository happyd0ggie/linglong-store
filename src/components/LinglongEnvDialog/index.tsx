import { useCallback } from 'react'
import { Button, Modal, Space, Typography } from 'antd'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useLinglongEnv } from '@/hooks/useLinglongEnv'
import { useGlobalStore } from '@/stores/global'

const MANUAL_INSTALL_URL = 'https://www.linglong.space/guide/start/install.html'

interface Props {
  open: boolean
  reason?: string
  onEnvReady?: () => Promise<void> | void
}

const LinglongEnvDialog = ({
  open: modalOpen,
  reason,
  onEnvReady,
}: Props) => {
  const { installEnv, checkEnv } = useLinglongEnv()
  // 分开订阅 store 状态，避免 selector 返回对象导致无限循环
  const checking = useGlobalStore((state) => state.checking)
  const installing = useGlobalStore((state) => state.installing)

  const closeApp = useCallback(async() => {
    const win = getCurrentWindow()
    await win.close()
  }, [])

  const handleExit = useCallback(async() => {
    await closeApp()
  }, [closeApp])

  const handleManualInstall = useCallback(async() => {
    await openUrl(MANUAL_INSTALL_URL)
  }, [closeApp])

  const handleAutoInstall = useCallback(async() => {
    try {
      await installEnv()
      const envResult = await checkEnv()
      if (envResult.ok && onEnvReady) {
        await onEnvReady()
      }
    } catch {
      // 错误提示在 hook 中已处理
    }
  }, [installEnv, checkEnv, onEnvReady])

  const handleRetry = useCallback(async() => {
    await checkEnv()
    if (onEnvReady) {
      await onEnvReady()
    }
  }, [checkEnv, onEnvReady])

  return (
    <Modal
      open={modalOpen}
      centered
      closable={false}
      maskClosable={false}
      title="检测到当前系统缺少玲珑环境"
      footer={
        <Space>
          <Button onClick={handleExit}>退出商店</Button>
          <Button onClick={handleManualInstall}>手动安装</Button>
          <Button
            type="primary"
            loading={installing}
            disabled={checking}
            onClick={handleAutoInstall}>
            自动安装
          </Button>
          <Button
            type="link"
            disabled={checking}
            onClick={handleRetry}>
            重新检测
          </Button>
        </Space>
      }>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Typography.Paragraph type="danger" strong style={{ marginBottom: 0 }}>
          检测到系统中不存在或版本过低的玲珑组件，需先安装后才能使用商店。
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          {reason || '请确认已安装玲珑环境。自动安装会弹出系统授权窗口，请输入密码继续。'}
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          自动安装适配 Deepin 23/25、UOS 1070、openEuler 23.09/24.03、Ubuntu 24.04、Debian 12/13、openKylin 2.0、Fedora 41/42、AnolisOS 8、Arch/Manjaro/Parabola。
        </Typography.Paragraph>
        <Typography.Text type="secondary">
          自动安装完成后，无需重启应用。
        </Typography.Text>
      </Space>
    </Modal>
  )
}

export default LinglongEnvDialog
