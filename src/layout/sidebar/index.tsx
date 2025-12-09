import styles from './index.module.scss'
import { useNavigate, useLocation } from 'react-router-dom'
import menuList from './components/menuList'
import SpeedTool from './components/speedTool'
import { Badge, Popover } from 'antd'
import { Speed } from '@icon-park/react'
import { useSearchStore } from '@/stores/global'
import { useMenuBadges } from '@/hooks/useMenuBadges'

const Sidebar = ({ className }: { className: string }) => {
  // const updateAppSum = useInitStore((state) => state.updateAppNum)
  const resetKeyword = useSearchStore((state) => state.resetKeyword)
  const menuBadges = useMenuBadges()
  const navigate = useNavigate()
  const location = useLocation()

  const handleMenuClick = (menuPath: string) => {
    resetKeyword()
    navigate(menuPath)
  }

  return (
    <div className={`${styles.sidebar} ${className}`}>
      <div className={styles.menu}>
        {
          menuList.map((item, index) => {
            const isActive = location.pathname === item.menuPath
            const badgeCount = menuBadges[item.menuPath] || 0
            return (
              <div
                className={`${styles.menuItem} ${isActive ? styles.active : ''}`}
                key={index}
                onClick={() => handleMenuClick(item.menuPath)}
                style={{ cursor: 'pointer' }}
              >
                <span className={styles.menuItemIcon}>
                  {isActive ? item.activeIcon : item.icon}
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
      </div>
      <div className={styles.speedToolContainer}>
        <div className={styles.speedTool}>
          <SpeedTool />
        </div>
        <div className={styles.speedToolIcon}>
          <Popover
            trigger='click'
            content={
              <SpeedTool />
            }
          >
            <Speed theme="outline" size="16" fill="var(--ant-color-text-secondary)"/>
          </Popover>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
