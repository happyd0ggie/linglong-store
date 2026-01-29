import { Descriptions, Drawer, Form, FormProps, Input, Button, Checkbox, message, Upload, type UploadProps } from 'antd'
import styles from './index.module.scss'
import feedback from '@/assets/icons/feedback.svg'
import upgradeApp from '@/assets/icons/upgradeApp.svg'
import { useState, useEffect, useMemo } from 'react'
import { getLlCliVersion } from '@/apis/invoke'
import { getSearchAppList, suggest, uploadLog } from '@/apis/apps/index'
import { useGlobalStore } from '@/stores/global'
import { useUpdateStore } from '@/hooks/useUploadStore'
import TextArea from 'antd/es/input/TextArea'
import { readFile } from '@tauri-apps/plugin-fs'
import { homeDir, join } from '@tauri-apps/api/path'

type FieldType = {
  classification?: string[];
  overview?: string;
  description?: string;
  uploadLog?: boolean;
};
// 问题类型
const feedOptions = ['商店缺陷', '应用更新', '应用故障']

const LOG_FILE_RELATIVE = '.local/share/com.dongpl.linglong-store.v2/logs/linglong-store.log'

const AboutSoft = () => {
  const [open, setOpen] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()
  const [form] = Form.useForm()
  const [linglongVersion, setLinglongVersion] = useState<string>('1.7.4')
  const [linglongCount, setLinglongCount] = useState<string>('未知')
  const repoName = useGlobalStore((state) => state.repoName)
  const arch = useGlobalStore((state) => state.arch)
  const appVersion = useGlobalStore((state) => state.appVersion)
  const visitorId = useGlobalStore((state) => state.visitorId)
  const { checkForUpdate, checking } = useUpdateStore()

  const linglongData = useMemo(() => [
    {
      label: '玲珑官网',
      value: 'https://linyaps.org.cn/',
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
      let logFileUrl: string | undefined
      if (values.uploadLog) {
        try {
          const baseDir = await homeDir()
          const logFilePath = await join(baseDir, LOG_FILE_RELATIVE)
          const fileBytes = await readFile(logFilePath)
          const logFile = new File([fileBytes], 'linglong-store.log', { type: 'text/plain' })
          const uploadRes = await uploadLog(logFile)
          if (uploadRes.code === 200 && uploadRes.data) {
            logFileUrl = uploadRes.data
          } else {
            messageApi.error(uploadRes.message || '日志上传失败')
            return
          }
        } catch (error) {
          console.error('Upload log error:', error)
          messageApi.error('日志上传失败')
          return
        }
      }
      const msg = `分类: ${values.classification?.join(', ') || '无'}\n概述: ${values.overview || '无'}\n描述: ${values.description || '无'}`
      const res = await suggest({
        message: msg,
        llVersion: linglongVersion,
        appVersion: appVersion,
        arch: arch,
        visitorId: visitorId,
        ...(logFileUrl ? { logFileUrl } : {}),
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
            <Form.Item colon label="" name="uploadLog" valuePropName="checked">
                <Checkbox>上传日志</Checkbox>
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
