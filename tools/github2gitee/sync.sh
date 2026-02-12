#!/bin/bash

# GitHub Release 同步到 Gitee 的便捷脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# 检查 .env 文件
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 错误：未找到 .env 配置文件"
    echo ""
    echo "请先创建配置文件："
    echo "  cp $SCRIPT_DIR/.env.example $SCRIPT_DIR/.env"
    echo ""
    echo "然后编辑 .env 文件，填入你的 Token 信息"
    exit 1
fi

# 加载环境变量
set -a
source "$ENV_FILE"
set +a

# 检查必要的环境变量
if [ -z "$GITHUB_TOKEN" ] || [ -z "$GITEE_TOKEN" ]; then
    echo "❌ 错误：缺少必要的 Token 配置"
    echo ""
    echo "请检查 .env 文件中的配置："
    echo "  GITHUB_TOKEN=your_github_token"
    echo "  GITEE_TOKEN=your_gitee_token"
    exit 1
fi

# 运行同步脚本
echo "🚀 开始同步 GitHub Release 到 Gitee..."
echo ""

node "$SCRIPT_DIR/github2gitee.js" "$@"

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo ""
    echo "✨ 同步成功完成！"
else
    echo ""
    echo "❌ 同步失败，退出码: $exit_code"
    exit $exit_code
fi
