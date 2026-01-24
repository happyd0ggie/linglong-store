import { Star, ApplicationOne, UpdateRotation, Ranking } from '@icon-park/react'

export default [
  {
    menuName: '玲珑推荐',
    menuPath: '/',
    icon: <Star theme="outline" size="16" fill="var(--ant-color-text-secondary)"/>,
    activeIcon: <Star theme="filled" size="16" fill="var(--ant-color-primary-text)"/>,
    show: true,
    index: 0,
  },
  {
    menuName: '排行榜',
    menuPath: '/ranking',
    icon: <Ranking theme="outline" size="16" fill="var(--ant-color-text-secondary)"/>,
    activeIcon: <Ranking theme="outline" size="16" fill="var(--ant-color-primary-text)"/>,
    show: false,
    index: 1,
  },
  {
    menuName: '全部应用',
    menuPath: '/allapps',
    icon: <ApplicationOne theme="outline" size="16" fill="var(--ant-color-text-secondary)"/>,
    activeIcon: <ApplicationOne theme="outline" size="16" fill="var(--ant-color-primary-text)"/>,
    show: true,
    index: 2,
  },
  {
    menuName: '软件更新',
    menuPath: '/update_apps',
    icon: <UpdateRotation theme="outline" size="16" fill="var(--ant-color-text-secondary)"/>,
    show: true,
    activeIcon: <UpdateRotation theme="outline" size="16" fill="var(--ant-color-primary-text)"/>,
    index: 5,
  },

]
