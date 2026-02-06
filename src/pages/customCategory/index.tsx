import styles from './index.module.scss'
import ApplicationCard from '@/components/ApplicationCard'
import { useEffect, useState, useRef } from 'react'
import { getAppListByCategoryIds, getRecommendAppList } from '@/apis/apps/index'
import { useGlobalStore } from '@/stores/global'
import { generateEmptyCards } from './utils'
import { OperateType } from '@/constants/applicationCard'
import { Select, Checkbox, type CheckboxProps } from 'antd'
import { useParams } from 'react-router-dom'
const defaultPageSize = 30 // 每页显示数量
type AppInfo = API.APP.AppMainDto
const OfficeApps = () => {
  const { arch, repoName, customMenuCategory } = useGlobalStore()
  const [activeCategory] = useState<string>('')
  const [pageNo, setPageNo] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(false)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [allAppList, setAllAppList] = useState<AppInfo[]>([])
  const [recommendAppList, setRecommendAppList] = useState<AppInfo[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const { code } = useParams()
  const { categoryIds, name } = customMenuCategory.filter(item => item.code === code)[0]
  const [filter, setFilter] = useState<boolean>(false) // 是否过滤低分应用
  const [sortType, setSortType] = useState<string>('createTime') // 排序类型
  // 处理过滤低分应用的change事件
  const handleFilterChange:CheckboxProps['onChange'] = (e) => {
    setFilter(e.target.checked)
  }
  // 处理排序类型的change事件
  const handleSortTypeChange = (value: string) => {
    setSortType(value)
  }
  // 获取推荐应用
  const getHeaderRecommendAppList = () => {
    const params = {
      repoName,
      arch,
      pageNo: 1,
      pageSize: 5, // 只获取3个，可以写死
      categoryId: categoryIds.join(','),
    }
    // TODO: 获取推荐应用列表
    getRecommendAppList(params).then(res => {

      const newRecords = res.data || []
      setRecommendAppList(newRecords)
    })
  }

  // 获取应用列表
  const getAllAppList = ({ pageNo = 1, init = false }) => {
    setLoading(true)

    if (init) {
      // 初始化时先显示空卡片占位
      setAllAppList(generateEmptyCards(defaultPageSize))
    }
    try {
      getAppListByCategoryIds({
        menuCode: code,
        repoName,
        arch,
        filter,
        sortType,
        pageNo,
        pageSize: defaultPageSize,
      }).then(res => {
        const newRecords = res.data.records || []

        if (init) {
          // 初始化时直接替换
          setAllAppList(newRecords)
        } else {
          // 追加新数据时，过滤掉空卡片后再追加
          setAllAppList(prev => {
            const filteredPrev = prev.filter(item => !item.appId?.startsWith('empty-'))
            return [...filteredPrev, ...newRecords]
          })
        }

        setTotalPages(res.data.pages || 1)
        setLoading(false)
      })
    } catch (error) {
      console.error('获取应用列表失败:', error)
      // 错误时移除空卡片
      if (init) {
        setAllAppList([])
      }
      setLoading(false)
    }
  }

  // 初始化获取数据
  useEffect(() => {
    getAllAppList({ init: true })
    getHeaderRecommendAppList() // 只发一次请求
  }, [code])
  // 监听filter和sortType参数变化
  useEffect(() => {
    getAllAppList({ init: true })
  }, [filter, sortType])
  // 监听滚动
  useEffect(() => {
    const handleScroll = () => {
      if (loading) {
        return
      }
      const listElement = listRef.current
      if (listElement) {
        const { scrollTop, scrollHeight, clientHeight } = listElement
        // 滚动到底部时加载更多
        if (scrollTop + clientHeight >= scrollHeight - 100) {
          if (pageNo < totalPages) {
            setPageNo(pageNo + 1)
            getAllAppList({ pageNo: pageNo + 1 })
          }
        }
      }
    }

    const listElement = listRef.current
    if (listElement) {
      listElement.addEventListener('scroll', handleScroll)
    }

    return () => {
      if (listElement) {
        listElement.removeEventListener('scroll', handleScroll)
      }
    }
  }, [activeCategory, pageNo, totalPages, loading])

  return <div className={styles.officeAppsPage} ref={listRef} >
    <div className={styles.search} >
      <h3>{name}</h3>
      <div className={styles.searchBox}>
        <Select
          defaultValue={sortType}
          style={{ minWidth: '5rem', maxWidth: '20rem', flex: 1 }}
          onChange={handleSortTypeChange}
          options={[
            { value: 'createTime', label: '按上架时间排序' },
            { value: 'installCount', label: '按安装量排序' },
            { value: 'last30Downloads', label: '按近30天下载量排序' },
          ]}
        />
        <Checkbox checked={filter}
          onChange={handleFilterChange}>过滤低分应用</Checkbox>
      </div>
    </div>
    <div className={styles.recommendApplicationList} style={{ marginTop: recommendAppList.length > 0 ? '3rem' : 0 }}>
      {
        recommendAppList.map((item, index) => {
          return index < 3 && (
            <ApplicationCard
              type="recommend"
              key={`${item.appId}_${index}`}
              appInfo={item}
              operateId={OperateType.INSTALL}
            />
          )
        })
      }
    </div>
    <div className={styles.applicationList}>
      {
        allAppList.map((item, index) => {
          return (
            <ApplicationCard
              key={`${item.appId}_${index}`}
              appInfo={item}
              operateId={OperateType.INSTALL}
            />
          )
        })
      }
      {loading && <div className={styles.loadingTip}>加载中...</div>}
      {totalPages <= pageNo && allAppList.length > 0 && <div className={styles.noMoreTip}>没有更多数据了</div>}
    </div>
  </div>
}

export default OfficeApps
