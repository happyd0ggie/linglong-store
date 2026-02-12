# GitHub Release 同步到 Gitee 工具

自动将 GitHub 仓库的 Release 同步到 Gitee 仓库的脚本工具。

## 功能特性

- ✅ 同步最新的 10 个 Release 版本
- ✅ 包含版本号、标题、描述等完整信息
- ✅ **自动下载并上传附件到 Gitee**
- ✅ 智能检测同版本号是否需要更新
  - 对比 Release 描述内容
  - 对比附件数量、名称和大小
- ✅ 增量更新，避免重复同步
- ✅ 自动重试机制（上传失败自动重试 3 次）
- ✅ 详细的日志输出
- ✅ 自动清理临时文件

## 前置要求

- Node.js 18+ （因为项目使用 ES Modules）
- GitHub Personal Access Token
- Gitee Access Token

## 安装配置

### 1. 获取 GitHub Token

1. 访问 [GitHub Settings - Personal access tokens](https://github.com/settings/tokens)
2. 点击 "Generate new token" → "Generate new token (classic)"
3. 设置 Token 名称，选择权限：
   - `repo` (完整仓库访问权限)
4. 生成并复制 Token（格式：`ghp_xxxx...`）

### 2. 获取 Gitee Token

1. 访问 [Gitee 设置 - 私人令牌](https://gitee.com/profile/personal_access_tokens)
2. 点击 "生成新令牌"
3. 设置令牌描述，选择权限：
   - `projects` (完整仓库访问权限)
4. 生成并复制 Token

### 3. 配置环境变量

#### 方法一：使用 .env 文件（推荐）

```bash
# 复制配置模板
cp linglong-docs/.env.example linglong-docs/.env

# 编辑 .env 文件，填入你的 Token 和仓库信息
nano linglong-docs/.env
```

#### 方法二：直接设置环境变量

```bash
export GITHUB_TOKEN="ghp_your_github_token"
export GITEE_TOKEN="your_gitee_token"
export GITHUB_REPO="SXFreell/linglong-store"
export GITEE_REPO="SXFreell/linglong-store"
```

## 使用方法

### 运行脚本

```bash
# 进入脚本目录
cd linglong-docs

# 如果使用 .env 文件，需要先加载环境变量
export $(cat .env | xargs)

# 运行同步脚本
node github2gitee.js
```

### 输出示例

```
🚀 开始同步 GitHub Release 到 Gitee

GitHub 仓库: SXFreell/linglong-store
Gitee 仓库: SXFreell/linglong-store
同步数量: 最新 10 个版本

📥 正在获取 GitHub 仓库 SXFreell/linglong-store 的 Release...
✅ 获取到 10 个 Release
📥 正在获取 Gitee 仓库 SXFreell/linglong-store 的 Release...
✅ 获取到 8 个 Release

📦 处理 Release: v2.0.0-beta.1
  ✅ 版本 v2.0.0-beta.1 无需更新

📦 处理 Release: v2.0.0-alpha.5
  📝 简介不同，需要更新
  🗑️  删除旧版本 v2.0.0-alpha.5...
  ✅ 已删除旧版本
  🚀 创建 Release...
  ✅ Release 创建成功 (ID: 12345)
  📦 开始处理 2 个附件...

    📄 处理: linglong-store_2.0.0-alpha.5_amd64.deb (45.23 MB)
      正在下载...
      ✓ 下载完成
      正在上传: linglong-store_2.0.0-alpha.5_amd64.deb (45.23 MB)
      ✓ 上传成功

    📄 处理: linglong-store_2.0.0-alpha.5_amd64.AppImage (48.56 MB)
      正在下载...
      ✓ 下载完成
      正在上传: linglong-store_2.0.0-alpha.5_amd64.AppImage (48.56 MB)
      ✓ 上传成功

  ✅ 附件处理完成: 2/2 个成功上传

✨ 同步完成！
```

## 工作原理

### 同步流程

1. **获取 Release 列表**
   - 从 GitHub 获取最新的 10 个 Release
   - 从 Gitee 获取现有的 Release 列表

2. **对比检测**
   - 对于每个 GitHub Release，检查 Gitee 是否存在同版本
   - 如果存在，对比以下内容：
     - Release 描述（body）
     - 附件数量、名称和大小

3. **更新策略**
   - 如果检测到差异，删除 Gitee 上的旧版本
   - 创建新的 Release（带有原始描述）
   - 下载所有附件到临时目录
   - 逐个上传附件到 Gitee Release

4. **附件处理**
   - 从 GitHub 下载附件到本地临时目录
   - 检查文件大小（跳过超过 100MB 的文件）
   - 使用 multipart/form-data 格式上传到 Gitee
   - 上传失败自动重试最多 3 次
   - 完成后自动清理临时文件

### 同步规则

- ✅ **新版本**: 直接创建
- ✅ **描述变化**: 删除重建
- ✅ **附件变化**: 删除重建
- ⏭️ **完全相同**: 跳过同步

## 高级配置

### 修改同步数量

编辑 `github2gitee.js` 文件，修改 `MAX_RELEASES` 配置：

```javascript
const CONFIG = {
  // ...其他配置
  MAX_RELEASES: 10, // 改为你需要的数量
};
```

### 定时自动同步

使用 cron 定时任务（Linux/macOS）：

```bash
# 编辑 crontab
crontab -e

# 添加定时任务（每天凌晨 2 点执行）
0 2 * * * cd /path/to/llstore/linglong-docs && export $(cat .env | xargs) && node github2gitee.js >> sync.log 2>&1
```

或使用 GitHub Actions：

```yaml
# .github/workflows/sync-to-gitee.yml
name: Sync Release to Gitee

on:
  release:
    types: [published]
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Run Sync
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITEE_TOKEN: ${{ secrets.GITEE_TOKEN }}
          GITHUB_REPO: ${{ github.repository }}
          GITEE_REPO: 'SXFreell/linglong-store'
        run: node linglong-docs/github2gitee.js
```

## 注意事项

⚠️ **安全提示**
- 永远不要将 `.env` 文件提交到 Git 仓库
- 已添加到 `.gitignore` 中
- Token 具有完整仓库访问权限，请妥善保管

⚠️ **API 限制**
- GitHub API 限制：5000 次/小时（已认证）
- Gitee API 限制：5000 次/小时
- 大文件上传可能较慢，请耐心等待

⚠️ **已知限制**
- Release 创建时需要对应的 Git Tag 已存在于 Gitee 仓库
- 单个附件文件大小限制：100MB（Gitee 限制）
- 超大文件会被跳过，建议使用 Git LFS 或外部存储
- 建议先将 Git Tag 推送到 Gitee：`git push gitee --tags`
- 附件上传需要良好的网络连接

## 故障排查

### Token 无效

```
❌ 错误：缺少必要的 token 配置
```

**解决方法**: 检查环境变量是否正确设置，Token 是否有效

### 网络错误

```
❌ 请求失败: ECONNRESET
```

**解决方法**: 检查网络连接，可能需要配置代理

### 权限错误

```
❌ 创建失败: 403 Forbidden
```

**解决方法**: 
- 检查 Token 权限是否足够
- 确认仓库名称是否正确
- 确认 Git Tag 是否已创建

### Tag 不存在错误

```
💡 提示: 请确保 Git Tag "v2.0.0" 已经存在于 Gitee 仓库中
```

**解决方法**:
```bash
# 推送所有 tag 到 Gitee
git push gitee --tags

# 或推送特定 tag
git push gitee v2.0.0
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
