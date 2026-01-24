import recommend from '@/assets/icons/recommend.svg'
import recommendActive from '@/assets/icons/recommendA.svg'
import rank from '@/assets/icons/rank.svg'
import rankA from '@/assets/icons/rankA.svg'
import update from '@/assets/icons/update.svg'
import updateA from '@/assets/icons/updateA.svg'
import classify from '@/assets/icons/classify.svg'
import classifyA from '@/assets/icons/classifyA.svg'
import office from '@/assets/icons/office.svg'
import officeA from '@/assets/icons/officeA.svg'
import system from '@/assets/icons/system.svg'
import systemA from '@/assets/icons/systemA.svg'
import develop from '@/assets/icons/develop.svg'
import developA from '@/assets/icons/developA.svg'
import games from '@/assets/icons/games.svg'
import gamesA from '@/assets/icons/gamesA.svg'


export default [
  {
    menuName: '推荐',
    menuPath: '/',
    icon: recommend,
    activeIcon: recommendActive,
    show: true,
    index: 0,
  },
  {
    menuName: '排行榜',
    menuPath: '/ranking',
    icon: rank,
    activeIcon: rankA,
    show: false,
    index: 1,
  },
  {
    menuName: '分类',
    menuPath: '/allapps',
    icon: classify,
    activeIcon: classifyA,
    show: true,
    index: 2,
  },
  {
    menuName: '办公',
    menuPath: '/officeapps',
    icon: office,
    activeIcon: officeA,
    show: true,
    index: 3,
  },
  {
    menuName: '系统',
    menuPath: '/systemapps',
    icon: system,
    activeIcon: systemA,
    show: true,
    index: 4,
  },
  {
    menuName: '开发',
    menuPath: '/developapps',
    icon: develop,
    activeIcon: developA,
    show: true,
    index: 5,
  },
  {
    menuName: '娱乐',
    menuPath: '/gameapps',
    icon: games,
    activeIcon: gamesA,
    show: true,
    index: 6,
  },
  {
    menuName: '更新',
    menuPath: '/update_apps',
    icon: update,
    show: true,
    activeIcon: updateA,
    index: 7,
  },

]
