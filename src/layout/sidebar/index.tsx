import styles from './index.module.scss'
import { useNavigate, useLocation } from 'react-router-dom'
import menuList from './components/menuList'
import { Badge, Modal } from 'antd'
import { useSearchStore, useGlobalStore } from '@/stores/global'
import { useMenuBadges } from '@/hooks/useMenuBadges'
import MyApp from '@/assets/icons/myApp.svg'
import downloadApp from '@/assets/icons/downloadApp.svg'
import downloadAppActive from '@/assets/icons/downloadAppActive.svg'
import Appsetting from '@/assets/icons/appSetting.svg'
import DownloadProgress from '@/components/DownloadProgress'
import { useState, useEffect } from 'react'
import { useInstallQueueStore } from '@/stores/installQueue'

const Sidebar = ({ className }: { className: string }) => {
  // const updateAppSum = useInitStore((state) => state.updateAppNum)
  const resetKeyword = useSearchStore((state) => state.resetKeyword)
  const customMenus = useGlobalStore((state) => state.customMenuCategory)
  const menuBadges = useMenuBadges()
  const navigate = useNavigate()
  const location = useLocation()
  const [customMenuActive, setCustomMenuActive] = useState<string|null>(null)
  const [isShowDownloadProcess, setIsShowDownloadProcess] = useState<boolean>(false)
  /** 下载管理面板显示状态 */
  const [hasDownloading, setHasDownloading] = useState(false)
  /** 当前安装任务 */
  const currentTask = useInstallQueueStore((state) => state.currentTask)
  const handleMenuClick = (type: string, menuPath: string) => {
    setCustomMenuActive(null) // 重置自定义菜单激活状态
    if (type === 'page') {
      resetKeyword()
      navigate(menuPath)
    } else if (type === 'custom') {
      setCustomMenuActive(menuPath)
      navigate(menuPath)
    } else {
      setIsShowDownloadProcess(true)
    }
  }
  /**
   * 监听当前安装任务变化，更新是否有下载中的应用标志
   */
  useEffect(() => {
    setHasDownloading(currentTask !== null)
  }, [currentTask])
  return (
    <div className={`${styles.sidebar} ${className}`}>
      <div className={styles.menu}>
        {
          menuList.map((item, index) => {
            const isActive = location.pathname === item.menuPath
            const badgeCount = menuBadges[item.menuPath] || 0
            return item.show && (
              <div
                className={`${styles.menuItem} ${isActive ? styles.active : ''}`}
                key={index}
                onClick={() => handleMenuClick('page', item.menuPath)}
                style={{ cursor: 'pointer' }}
              >
                <span className={styles.menuItemIcon}>
                  <img src={isActive ? item.activeIcon : item.icon} alt={item.menuName} />
                  {/* {isActive ? item.activeIcon : item.icon} */}
                </span>
                <Badge
                  count={badgeCount}
                  overflowCount={99}
                  showZero={false}
                  size='small'
                  offset={[6, 0]}
                  className={styles.menuBadge}
                >
                  <span className={styles.menuItemText}>{item.menuName}</span>
                </Badge>
              </div>
            )
          })
        }
        {
          customMenus.map((item, index) => {
            const isActive = location.pathname === '/custom_category' && customMenuActive === item.code
            return item.enabled && (
              <div
                className={`${styles.menuItem} ${isActive ? styles.active : ''}`}
                key={index}
                onClick={() => handleMenuClick('custom', item.code)}
                style={{ cursor: 'pointer' }}
              >
                <span className={styles.menuItemIcon}>
                  <img src={isActive ? item.activeIcon : item.icon} alt={item.name} />
                  {/* {isActive ? item.activeIcon : item.icon} */}
                </span>
                <Badge
                  count={0}
                  overflowCount={99}
                  showZero={false}
                  size='small'
                  offset={[6, 0]}
                  className={styles.menuBadge}
                >
                  <span className={styles.menuItemText}>{item.name}</span>
                </Badge>
              </div>
            )
          })
        }
      </div>
      <div className={styles.footerIcons} >
        <img src={MyApp} alt="MyApp" onClick={() => handleMenuClick('page', '/my_apps')} />
        <img src={hasDownloading ? downloadAppActive : downloadApp} alt="downloadApp" onClick={() => handleMenuClick('component', 'downloadApp')} />
        <img src={Appsetting} alt="Appsetting" onClick={() => handleMenuClick('page', '/setting')} />
      </div>
      <Modal
        title="下载管理"
        footer={null}
        centered={true}
        closable={false}
        keyboard={true}
        maskClosable={true}
        open={isShowDownloadProcess}
        width={400}
        onCancel={() => setIsShowDownloadProcess(false)}
      >
        <DownloadProgress/>
      </Modal>
    </div>
  )
}

export default Sidebar
