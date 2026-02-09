#!/usr/bin/env bash
#
# install-deps.sh
# 在 Debian 上安装 Rust + Tauri + GTK/WebKit 所需的系统依赖
# 用法：
#   chmod +x install-deps.sh
#   ./install-deps.sh
#

set -euo pipefail

echo "==> 检查是否为基于 Debian 的系统（需要 apt/apt-get）..."
if ! command -v apt-get >/dev/null 2>&1; then
  echo "错误：未找到 apt-get，此脚本仅适用于 Debian/Ubuntu 系列系统。"
  exit 1
fi

echo "==> 更新软件源..."
sudo apt-get update

echo "==> 安装构建工具和 pkg-config..."
sudo apt-get install -y \
  build-essential \
  pkg-config

echo "==> 安装 GLib / GTK3 / 图形相关开发库..."
sudo apt-get install -y \
  libglib2.0-dev \
  libgtk-3-dev \
  libgdk-pixbuf-2.0-dev \
  libcairo2-dev \
  libpango1.0-dev \
  libatk1.0-dev

echo "==> 安装网络 / Web 相关库 (libsoup3 + WebKitGTK + JavaScriptCore)..."
sudo apt-get install -y \
  libsoup-3.0-dev \
  libwebkit2gtk-4.1-dev \
  libjavascriptcoregtk-4.1-dev

echo "==> （可选）安装无障碍 AT-SPI 总线，消除 AT-SPI 警告..."
sudo apt-get install -y \
  at-spi2-core

echo "==> 安装编译相关库..."
sudo apt-get install -y \
  build-essential \
  curl wget file \
  pkg-config \
  libssl-dev \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  librsvg2-dev \
  xdg-utils \
  patchelf \
  desktop-file-utils \
  libglib2.0-bin \
  squashfs-tools


echo "==> 所有依赖安装完成！"
echo "现在可以回到项目目录重新运行，例如："
echo "  cd ~/linglong-store/rust-linglong-store"
echo "  cargo run   # 或 pnpm tauri dev / npm run tauri dev 等"
