import { Descriptions, Drawer, Form, FormProps, Input, Button, Checkbox, Modal, message } from 'antd'
import styles from './index.module.scss'
import feedback from '@/assets/icons/feedback.svg'
import update from '@/assets/icons/update.svg'
import { useState, useEffect, useMemo } from 'react'
import { getLlCliVersion } from '@/apis/invoke'
import { getSearchAppList } from '@/apis/apps/index'
import { useGlobalStore } from '@/stores/global'
import TextArea from 'antd/es/input/TextArea'

type FieldType = {
  classification?: string[];
  overview?: string;
  description?: string;
};
// 问题类型
const feedOptions = ['商店缺陷', '应用更新', '应用故障']

const AboutSoft = () => {
  const [open, setOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()
  const [form] = Form.useForm()
  const [linglongVersion, setLinglongVersion] = useState<string>('1.7.4')
  const [linglongCount, setLinglongCount] = useState<string>('未知')
  const repoName = useGlobalStore((state) => state.repoName)
  const arch = useGlobalStore((state) => state.arch)

  const linglongData = useMemo(() => [
    {
      label: '玲珑官网',
      value: 'https://linglong.space/',
    },
    {
      label: '玲珑网页版商店',
      value: 'https://store.linyaps.org.cn/',
    },
    {
      label: '当前已收录玲珑程序数',
      value: linglongCount === '未知' ? '未知' : `${linglongCount} 个`,
    },
  ], [linglongCount])

  const versionData = useMemo(() => [
    {
      label: '当前商店版本',
      value: '2.0.0-beta',
    },
    {
      label: '当前玲珑组件版本',
      value: linglongVersion,
    },
    {
      label: '开发作者',
      value: 'Jokul<986432015@qq.com>',
    },
    {
      label: '码云地址',
      value: 'https://gitee.com/jokul2018/linglong_store',
    },
    {
      label: 'GitHub地址',
      value: 'https://github.com/GershonWang/linglong-store',
    },
  ], [linglongVersion])

  const descriptionStyles = useMemo(() => ({
    header: {
      marginBottom: 0,
    },
  }), [])

  const checkVersionClick = () => {
    console.log('检查版本更新逻辑')
    const num = Math.random()
    if (num > 0.5) {
      setModalOpen(true)
      return
    }
    messageApi.success('当前已是最新版本', 1)
  }

  const feedbackClick = () => {
    setOpen(true)
  }

  const onClose = () => {
    setOpen(false)
  }

  const onClickSubmitForm: FormProps<FieldType>['onFinish'] = (values) => {
    console.log('提交反馈数据: ', values)
    messageApi.success('感谢您的反馈', 1)
    setOpen(false)
  }

  useEffect(() => {
    // 获取 ll-cli 版本并显示
    getLlCliVersion()
      .then((v) => {
        if (v) {
          setLinglongVersion(v as string)
        }
      })
      .catch((e) => {
        console.warn('Failed to get ll-cli version:', e)
        setLinglongVersion('未知')
      })
  }, [])

  useEffect(() => {
    const fetchLinglongCount = async() => {
      try {
        const res = await getSearchAppList({
          repoName,
          arch,
          pageNo: 1,
          pageSize: 1,
        })
        const total = res?.data?.total
        if (typeof total === 'number') {
          setLinglongCount(total.toString())
        } else {
          setLinglongCount('未知')
        }
      } catch (error) {
        console.warn('Failed to get linglong count:', error)
        setLinglongCount('未知')
      }
    }

    fetchLinglongCount()
  }, [repoName, arch])

  return (
    <div className={styles.aboutPage}>
      <p className={styles.about_app}>关于软件</p>
      <div className={styles.app_info}>
        <Descriptions
          className={styles.des_name}
          styles={descriptionStyles}
          colon={true}
          layout="horizontal"
          column={1}
          title='玲珑信息'> {linglongData.map((item, index) => (
            <Descriptions.Item label={item.label} key={`${item.value}_${index}`}>{item.value}</Descriptions.Item>
          ))}
        </Descriptions>
      </div>
      <div className={styles.version_info}>
        <Descriptions
          className={styles.des_name}
          styles={descriptionStyles}
          colon={true}
          layout="horizontal"
          column={1}
          title='版本信息'> {versionData.map((item, index) => (
            <Descriptions.Item label={item.label} key={`${item.value}_${index}`}>{item.value}</Descriptions.Item>
          ))}
        </Descriptions>
      </div>
      <div className={styles.feedback}>
        <div className={styles.feed} onClick={feedbackClick}>  <img style={{ width: '1.1rem', height: '1.1rem' }} src={feedback} alt="意见反馈" /><span>意见反馈</span></div>
        {contextHolder}
        <div className={styles.checkVersion} onClick={checkVersionClick}><img style={{ width: '1.1rem', height: '1.1rem' }} src={update} alt="检查版本" /><span>检查版本</span></div>
      </div>
      <Drawer
        title="意见反馈"
        onClose={onClose}
        open={open}
        closable={false}
        getContainer={false}
        destroyOnHidden={true}
      >
        <Form layout="horizontal" labelAlign="right" form={form} onFinish={onClickSubmitForm} clearOnDestroy={true}>
          <Form.Item colon label="分类" name="classification">
            <Checkbox.Group options={feedOptions} />
          </Form.Item>
          <Form.Item colon label="概述" name='overview'>
            <Input />
          </Form.Item>
          <Form.Item colon label="描述" name='description'>
            <TextArea rows={6} />
          </Form.Item>
          <Form.Item>
            <div style={{ textAlign: 'right' }}>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Drawer>
      <Modal
        title="版本更新"
        centered
        closable={false}
        okText="确认"
        cancelText="取消"
        width={300}
        open={modalOpen}
        onOk={() => setModalOpen(false)}
        onCancel={() => setModalOpen(false)}
      >
        <p>当前版本: 1.2.3</p>
        <p>最新版本: 1.2.5</p>
        <p>是否更新到最新版?</p>
      </Modal>
    </div>
  )
}

export default AboutSoft
