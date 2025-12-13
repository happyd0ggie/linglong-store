/**
 * 匿名统计确认弹窗组件
 *
 * 在首次启动时询问用户是否愿意发送匿名统计数据
 * 帮助我们改进玲珑商店
 */

import { Modal, Typography, Space, Button } from 'antd'
import { InfoCircleOutlined, HeartOutlined } from '@ant-design/icons'
import { useConfigStore } from '@/stores/appConfig'
import { useCallback } from 'react'

const { Text, Paragraph } = Typography

interface AnalyticsConsentDialogProps {
  /** 是否显示弹窗 */
  visible: boolean
  /** 用户做出选择后的回调 */
  onComplete?: (allowed: boolean) => void
}

/**
 * 匿名统计确认弹窗
 */
const AnalyticsConsentDialog: React.FC<AnalyticsConsentDialogProps> = ({
  visible,
  onComplete,
}) => {
  const setAllowAnalytics = useConfigStore((state) => state.setAllowAnalytics)

  const handleAllow = useCallback(() => {
    setAllowAnalytics(true)
    onComplete?.(true)
  }, [setAllowAnalytics, onComplete])

  const handleDeny = useCallback(() => {
    setAllowAnalytics(false)
    onComplete?.(false)
  }, [setAllowAnalytics, onComplete])

  return (
    <Modal
      title={
        <Space>
          <HeartOutlined style={{ color: '#1890ff' }} />
          <span>帮助我们改进玲珑商店</span>
        </Space>
      }
      open={visible}
      closable={false}
      maskClosable={false}
      keyboard={false}
      centered
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={handleDeny}>
            不发送
          </Button>
          <Button type="primary" onClick={handleAllow}>
            发送匿名数据
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Paragraph>
          为了持续改进简易玲珑商店的使用体验，我们希望收集一些匿名的使用数据，仅用于统计用途。
          您的参与将帮助我们了解哪些应用更受欢迎，从而更好地为您服务。
        </Paragraph>

        <div style={{
          background: '#f5f5f5',
          padding: '12px 16px',
          borderRadius: '8px',
        }}>
          <Space direction="vertical" size="small">
            <Text strong>
              <InfoCircleOutlined style={{ marginRight: 8 }} />
              我们仅收集以下信息：
            </Text>
            <ul style={{ margin: '8px 0', paddingLeft: '24px' }}>
              <li>安装和卸载的应用名称、AppID、IP地址</li>
              <li>系统架构和玲珑版本（用于兼容性分析）</li>
              <li>随机生成的匿名设备标识</li>
            </ul>
          </Space>
        </div>

        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          <Text type="secondary">
            我们 <Text strong>不会</Text> 收集您的个人信息、文件内容或应用列表。
            您可以随时在设置中更改此选项。
          </Text>
        </Paragraph>
      </Space>
    </Modal>
  )
}

export default AnalyticsConsentDialog
