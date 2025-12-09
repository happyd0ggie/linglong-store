/**
 * 下载进度组件
 * 显示安装队列中的任务状态和进度
 */
import styles from './index.module.scss'
import { useMemo } from 'react'
import DefaultIcon from '@/assets/linyaps.svg?url'
import { Progress, Empty, message } from 'antd'
import { useInstallQueueStore } from '@/stores/installQueue'
import { runApp } from '@/apis/invoke'

/**
 * 任务进度图标组件
 */
const TaskProgressIcon = ({
  percentage = 0,
  status,
}: {
  percentage?: number
  status: Store.InstallTaskStatus
}) => {
  // 根据状态确定进度条状态
  const progressStatus = useMemo(() => {
    switch (status) {
    case 'success':
      return 'success'
    case 'failed':
      return 'exception'
    case 'installing':
      return 'active'
    default:
      return 'normal'
    }
  }, [status])

  return (
    <div className={styles.downloadIcon}>
      <Progress
        percent={Number(percentage)}
        size={32}
        type="circle"
        status={progressStatus}
        strokeWidth={6}
        format={(percent) => `${Math.round(percent || 0)}%`}
      />
    </div>
  )
}

const DownloadProgress = () => {
  const [messageApi, contextHolder] = message.useMessage()
  const { currentTask, queue, history, clearHistory, removeFromQueue } = useInstallQueueStore()

  // 合并所有任务列表用于显示
  const allTasks = useMemo(() => {
    const tasks: Store.InstallTask[] = []

    // 当前正在执行的任务
    if (currentTask) {
      tasks.push(currentTask)
    }

    // 队列中等待的任务
    tasks.push(...queue)

    // 历史记录（最近完成的）
    tasks.push(...history.slice(0, 10)) // 只显示最近 10 条历史

    return tasks
  }, [currentTask, queue, history])

  /**
   * 清除已完成的历史记录
   */
  const cleanDownloadHistory = () => {
    if (history.length === 0) {
      messageApi.info('暂无已完成的下载记录!')
      return
    }

    clearHistory()
    messageApi.success(`已清除 ${history.length} 条下载记录`)
  }

  /**
   * 启动应用
   */
  const handleOpenApp = async(appId?: string) => {
    if (!appId) {
      messageApi.error('无法启动：缺少应用ID')
      return
    }

    try {
      await runApp(appId)
      messageApi.success('应用启动成功')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      messageApi.error(`启动失败: ${errorMessage}`)
    }
  }

  /**
   * 从队列中移除待安装的任务
   */
  const handleRemoveFromQueue = (taskId: string) => {
    removeFromQueue(taskId)
    messageApi.success('已从队列中移除')
  }

  /**
   * 渲染任务状态文本
   */
  const renderStatusText = (task: Store.InstallTask) => {
    switch (task.status) {
    case 'pending':
      return `等待中 (队列位置: ${queue.findIndex((t) => t.id === task.id) + 1})`
    case 'installing':
      return `${task.message} ${task.progress}%`
    case 'success':
      return '安装完成'
    case 'failed':
      return `安装失败: ${task.error || '未知错误'}`
    default:
      return task.message
    }
  }

  /**
   * 渲染任务操作按钮
   */
  const renderTaskActions = (task: Store.InstallTask) => {
    switch (task.status) {
    case 'pending':
      // 待安装的任务可以移除
      return (
        <button className={styles.closeBtn} onClick={() => handleRemoveFromQueue(task.id)}>
            ×
        </button>
      )
    case 'installing':
      // 正在安装的任务显示进度（不允许取消）
      return <TaskProgressIcon percentage={task.progress} status={task.status} />
    case 'success':
      // 安装成功显示打开按钮
      return (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={styles.downloadBtn} onClick={() => handleOpenApp(task.appId)}>
              打开
          </button>
        </div>
      )
    case 'failed':
      // 安装失败显示错误状态
      return <TaskProgressIcon percentage={0} status={task.status} />
    default:
      return null
    }
  }

  return (
    <>
      <div className={styles.downloadContainer}>
        <div className={styles.downloadBox}>
          {allTasks.length > 0 ? (
            allTasks.map((task) => (
              <div className={styles.downloadItem} key={task.id}>
                <div className={styles.itemLeft}>
                  <div className={styles.itemLeft_icon}>
                    <img src={task.appInfo?.icon || DefaultIcon} alt="应用图标" />
                  </div>
                  <div className={styles.itemLeft_content}>
                    <p className={styles.contentName}>
                      {task.appInfo?.zhName || task.appInfo?.name || task.appId || '应用名称'}
                    </p>
                    <p className={styles.contentSize}>{renderStatusText(task)}</p>
                  </div>
                </div>
                <div className={styles.itemRight}>{renderTaskActions(task)}</div>
              </div>
            ))
          ) : (
            <Empty description="暂无安装任务" />
          )}
        </div>
        {contextHolder}
        {history.length > 0 ? (
          <div className={styles.downloadFooter} onClick={cleanDownloadHistory}>
            清除下载记录
          </div>
        ) : null}
      </div>
    </>
  )
}

export default DownloadProgress
