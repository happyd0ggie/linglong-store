// 已安装应用信息
export interface InstalledApp {
  appId: string;
  name: string;
  version: string;
  arch: string;
  channel: string;
  description: string;
  icon: string;
  kind?: string;
  module: string;
  runtime: string;
  size: string;
  repoName: string;
  zhName?: string;
  categoryName?: string;
  loading?: boolean;
  occurrenceNumber?: number;
}

// 安装进度信息
export interface InstallProgress {
  appId: string; // 应用ID
  progress: string; // 原始进度文本
  percentage: number; // 百分比数值 (0-100)
  status: string; // 状态描述
}

// 安装取消事件
export interface InstallCancelled {
  appId: string; // 应用ID
  cancelled: boolean; // 是否已取消
  message: string; // 取消消息
}

// 应用更新信息
export interface UpdateInfo {
  appId: string;
  name: string;
  version: string; // 新版本
  currentVersion: string; // 当前版本
  description: string;
  icon: string;
  arch: string;
  categoryName?: string;
}

// 搜索结果项
export interface SearchResultItem {
  appId?: string;
  name: string;
  version: string;
  arch?: string | string[];
  description?: string;
  module?: string;
  icon?: string;
}
