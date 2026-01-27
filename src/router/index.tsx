import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { lazy } from 'react'
import Layout from '../layout'
import { useGlobalInstallProgress } from '@/hooks/useGlobalInstallProgress'

// 懒加载路由组件
const Recommend = lazy(() => import('../pages/recommend'))
const Ranking = lazy(() => import('../pages/ranking'))
const AllApps = lazy(() => import('../pages/allApps'))
const Setting = lazy(() => import('../pages/setting'))
const UpdateApp = lazy(()=>import('../pages/updateApp'))
const MyApplication = lazy(()=>import('../pages/myApps'))
const AppDetail = lazy(()=>import('../pages/appDetail'))
const SearchList = lazy(()=>import('../pages/searchList'))
const CustomCategory = lazy(()=>import('../pages/customCategory'))
// 路由配置
const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Recommend />,
      },
      {
        path: '/ranking',
        element: <Ranking />,
      },
      {
        path: '/allapps',
        element: <AllApps />,
      },
      {
        path: '/custom_category/:code',
        element: <CustomCategory />,
      },
      {
        path: '/setting',
        element: <Setting />,
      },
      {
        path: '/update_apps',
        element: <UpdateApp />,
      },
      {
        path: '/my_apps',
        element: <MyApplication />,
      },
      {
        path: '/app_detail',
        element: <AppDetail />,
      },
      {
        path: '/search_list',
        element: <SearchList />,
      },
    ],
  },
])

// 路由提供者组件
const Router = () => {
  // 设置全局安装进度监听
  useGlobalInstallProgress()

  return <RouterProvider router={router} />
}

export default Router
