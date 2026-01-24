import BaseSetting from './components/baseSetting'
import AboutApp from './components/about'
import styles from './index.module.scss'
import { useState } from 'react'

const AppSetting = () => {
  const [activeKey, setActiveKey] = useState('setting')
  const handleChange = (key: string) => {
    if (key === activeKey) {
      return
    }
    setActiveKey(key)
  }
  return <div className={styles.appSetting}>
    <header className={styles.header}>
      <h3 className={[styles.title, activeKey === 'setting' ? styles.activeTitle : ''].join(' ')} onClick={() => handleChange('setting')}>基础设置</h3>
      <h3 className={[styles.title, activeKey === 'about' ? styles.activeTitle : ''].join(' ')} onClick={() => handleChange('about')}>关于程序</h3>
    </header>
    <div className={styles.content} >
      {activeKey === 'setting' ? <BaseSetting /> : <AboutApp />}
    </div>
  </div>
}
export default AppSetting

