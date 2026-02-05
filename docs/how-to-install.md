# 玲珑商店社区版安装说明

本文档提供玲珑商店社区版的安装方式与安装后操作指引。请根据你的发行版与使用场景选择合适的方式。

## 方式一：安装器（推荐）

适用场景：不知道如何安装玲珑环境、不想手动安装玲珑环境、使用 UOS。

在终端执行以下命令启动安装器：

```shell
curl -fsSL https://mm.md/linglong-store-installer.sh | LLI_PREFER_PKEXEC=1 bash
```

安装器将自动完成玲珑环境与玲珑商店社区版（运行在玲珑容器内的版本）的安装。

安装器支持自动安装的发行版如下：

- Debian 系：Debian 12/13/Testing/Sid，Ubuntu 24.04/25.04/25.10，Linux Mint（映射到对应 Ubuntu LTS），MX Linux（映射到对应 Debian）。
- Red Hat 系：Fedora 41/42/43/Rawhide，openEuler 23.09/24.03，Anolis 8。
- 国产发行版：UOS 20（1070），openKylin 2.0，Deepin 23/23.1/25。
- Arch 系：Arch Linux，Manjaro，Parabola。
- openSUSE：openSUSE Leap 15.6。

注意：NixOS 和 麒麟（银河麒麟 V10）需要手动安装玲珑环境，安装器不支持自动安装。

### 如果你想手动下载安装器
1. 前往发布页下载与你的架构与发行版匹配的安装器：
	- GitHub Releases: <https://github.com/HanHan666666/linglong-installer/releases>
	- Gitee Releases: <https://gitee.com/hanplus/linglong-installer/releases/>

## 方式二：手动安装玲珑商店社区版（运行在玲珑容器内的版本）

此方法适用于已经安装了玲珑环境的用户

```shell
# 添加社区软件源
ll-cli repo add --alias=testing stable https://cdn-linglong.odata.cc
# 从社区源安装
ll-cli install com.dongpl.linglong-store.v2 --repo testing
```
## 方式三：手动下载 deb 或 rpm

适用发行版：Ubuntu/Debian/Fedora 等处于维护期的发行版。

1. 前往发布页下载与你的架构与发行版匹配的安装包：
	- GitHub Releases: <https://github.com/SXFreell/linglong-store/releases/>
	- Gitee Releases: <https://gitee.com/Shirosu/linglong-store/releases/>
2. 使用系统包管理器完成安装（例如图形化双击安装或命令行安装）。

## 安装完成后

- 启动：在系统应用菜单中搜索“玲珑商店”并启动。

## 卸载说明
卸载后需要您手动删除的目录：
> 日志及数据文件
- `~/.local/share/com.dongpl.linglong-store.v2`

> systemd 服务安装目录，用于响应容器内的ll-cli请求，deb/rpm版本不存在此目录。
- `~/.linglong-store-v2`
