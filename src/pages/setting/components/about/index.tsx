import { Descriptions, Drawer, Form, FormProps, Input, Button, Checkbox, message, Upload, type UploadProps } from 'antd'
import styles from './index.module.scss'
import feedback from '@/assets/icons/feedback.svg'
import upgradeApp from '@/assets/icons/upgradeApp.svg'
import { useState, useEffect, useMemo } from 'react'
import { getLlCliVersion } from '@/apis/invoke'
import { getSearchAppList, suggest } from '@/apis/apps/index'
import { useGlobalStore } from '@/stores/global'
import { useUpdateStore } from '@/hooks/useUploadStore'
import TextArea from 'antd/es/input/TextArea'

type FieldType = {
  classification?: string[];
  overview?: string;
  description?: string;
};
// 问题类型
const feedOptions = ['商店缺陷', '应用更新', '应用故障']

/**
 * 日志上传配置
 *
 * @type {UploadProps}
 */
const uploadProps: UploadProps = {
  name: 'file',
  action: 'https://660d2bd96ddfa2943b33731c.mockapi.io/api/upload',
  headers: {
    authorization: 'authorization-text',
  },
  onChange(info) {
    if (info.file.status !== 'uploading') {
      console.log(info.file, info.fileList)
    }
    if (info.file.status === 'done') {
      message.success(`${info.file.name} file uploaded successfully`)
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} file upload failed.`)
    }
  },
}
const AboutSoft = () => {
  const [open, setOpen] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()
  const [form] = Form.useForm()
  const [linglongVersion, setLinglongVersion] = useState<string>('1.7.4')
  const [linglongCount, setLinglongCount] = useState<string>('未知')
  const repoName = useGlobalStore((state) => state.repoName)
  const arch = useGlobalStore((state) => state.arch)
  const appVersion = useGlobalStore((state) => state.appVersion)
  const { checkForUpdate, checking } = useUpdateStore()

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
      value: appVersion,
    },
    {
      label: '当前玲珑组件版本',
      value: linglongVersion,
    },
    {
      label: '码云地址',
      value: 'https://gitee.com/Shirosu/linglong-store',
    },
    {
      label: 'GitHub地址',
      value: 'https://github.com/SXFreell/linglong-store',
    },
  ], [linglongVersion])

  const descriptionStyles = useMemo(() => ({
    header: {
      marginBottom: 0,
    },
  }), [])

  const checkVersionClick = () => {
    if (checking) {
      return
    }
    checkForUpdate(appVersion, false)
  }

  const feedbackClick = () => {
    setOpen(true)
  }

  const onClose = () => {
    setOpen(false)
  }

  const onClickSubmitForm: FormProps<FieldType>['onFinish'] = async(values) => {
    console.info('提交反馈数据: ', values)
    try {
      const msg = `分类: ${values.classification?.join(', ') || '无'}\n概述: ${values.overview || '无'}\n描述: ${values.description || '无'}`
      const res = await suggest({
        message: msg,
        llVersion: linglongVersion,
        appVersion: appVersion,
        arch: arch,
        visitorId: `repo|${repoName}`,
      })
      if (res.code === 200) {
        messageApi.success('感谢您的反馈', 1)
        setOpen(false)
        form.resetFields()
      } else {
        messageApi.error(res.message || '反馈提交失败')
      }
    } catch (error) {
      console.error('Feedback error:', error)
      messageApi.error('反馈提交失败')
    }
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
        <div className={styles.checkVersion} onClick={checkVersionClick}><img style={{ width: '1.1rem', height: '1.1rem' }} src={upgradeApp} alt="检查新版本" /><span>检查版本</span></div>
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
          <Form.Item colon label="日志" name='log'>
            <Upload {...uploadProps}>
              <Button>上传日志</Button>
            </Upload>
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
    </div>
  )
}

export default AboutSoft
