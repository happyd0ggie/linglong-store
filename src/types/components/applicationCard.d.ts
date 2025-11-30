declare namespace COMP {
  namespace APPCARD {
    // 操作项配置
    interface OperateItem {
      name: string;
      id: number;
    }

    // 应用卡片 Props
    interface ApplicationCardProps {
      /** 操作类型 ID，默认为安装 */
      operateId?: number;
      /** 应用信息 */
      appInfo?: API.APP.AppMainDto;
    }
  }
}
