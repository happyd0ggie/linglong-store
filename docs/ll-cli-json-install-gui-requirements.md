# ll-cli --json 安装输出解析与 GUI 状态机需求

## 目标与范围
本需求文档用于指导 GUI 团队实现对 `ll-cli install --json` 的解析与状态展示，
覆盖 **1.9 版本及以上** 的兼容性差异。目标是准确识别并呈现以下三类状态：

- 等待安装（未收到进度百分比）
- 安装中（收到进度百分比）
- 安装失败（错误输出或退出码非 0）

成功完成作为扩展状态，用于完善 UI 反馈。

## 适用版本说明
从 1.9 开始，`ll-cli --json` 的输出字段可能随版本变化或新增。
本需求要求 GUI **只依赖 `message`、`percentage`、`code`** 三个字段，
其余字段全部忽略。  
master 分支已简化输出，未来发布版本预计与 master 行为一致，因此必须兼容该输出格式。

## 输入与输出约定
GUI 通过启动子进程执行：

```
ll-cli install <APP_ID> --json
```

解析来源为 **stdout**。每一行通常是一段完整 JSON 对象，但仍需防御：

- 部分错误路径会输出非 JSON 文本；
- 有时只输出 `message`，没有 `percentage`。

解析策略必须为：

1. 尝试按 JSON 解析；
2. 解析失败则当作普通日志行，记录但不影响状态机。

## JSON 事件类型（统一抽象）
JSON 对象按字段归类为以下事件类型：

### 1) 进度事件 ProgressEvent
字段特征：

- 必含：`percentage` (number)
- 必含：`message` (string)

示例：
```
{"message":"Downloading files","percentage":38.4}
```

### 2) 错误事件 ErrorEvent
字段特征：

- 必含：`code` (number)
- 必含：`message` (string)

示例：
```
{"code":1234,"message":"Network connection failed..."}
```

### 3) 文本事件 MessageEvent
字段特征：

- 仅含：`message` (string)

示例：
```
{"message":"Install main:io.gnome.gimp/... success"}
```

## GUI 状态模型
建议使用以下状态枚举：

- `IDLE`：尚未开始或无法识别
- `WAITING`：等待安装（未收到进度百分比）
- `INSTALLING`：安装中（收到进度百分比）
- `FAILED`：安装失败或取消
- `SUCCEEDED`：安装成功（扩展）

本需求采用**极简策略**：状态仅由 `message/percentage/code` 和进程退出码决定。

## 状态机定义（核心逻辑）
### 状态机图（文本表示）
```
IDLE
  ├─ StartInstall ───────────────▶ WAITING
  ├─ ProgressEvent ──────────────▶ INSTALLING
  ├─ ErrorEvent ─────────────────▶ FAILED
  └─ ProcessExit(code!=0) ───────▶ FAILED

WAITING
  ├─ ProgressEvent ──────────────▶ INSTALLING
  ├─ ErrorEvent ─────────────────▶ FAILED
  ├─ Timeout(60s no progress) ───▶ FAILED
  └─ ProcessExit(code!=0) ───────▶ FAILED

INSTALLING
  ├─ ProgressEvent ──────────────▶ INSTALLING
  ├─ ErrorEvent ─────────────────▶ FAILED
  ├─ Timeout(60s no progress) ───▶ FAILED
  └─ ProcessExit(code!=0) ───────▶ FAILED
```

### 状态判定规则（详细）
1. **ErrorEvent**
   - JSON 含 `code` → 直接判定 `FAILED`。
2. **ProgressEvent**
   - JSON 含 `percentage` → 判定 `INSTALLING`，更新进度条并刷新进度超时计时器。
3. **MessageEvent**
   - 仅用于展示日志或提示，不改变状态。
4. **超时**
   - 启动安装后 **60 秒内未读取到进度百分比** → 判定 `FAILED`。
   - 若已进入 `INSTALLING`，则以**上一次 ProgressEvent 的时间**为起点重新计时。
5. **进程退出**
   - 退出码 `0` → `SUCCEEDED`
   - 非 `0` → `FAILED`

**注意**：进程退出码是最终裁决条件，应覆盖此前任何临时状态。

## 进度条与信息展示规则
- `percentage` 用于进度条更新（>100 强制 clamp 到 100）。
- `message` 作为状态说明文本。
- 若处于 `WAITING`（未收到进度），显示 “等待安装” 或 “排队中”。

## 安装失败识别的可靠策略
必须使用多因子判定：

1. **进程退出码**（最高优先级）
   - 非 0 即失败。
2. **ErrorEvent**
   - JSON 包含 `code` 字段 → 失败。
3. **超时**
   - 60 秒内没有进度百分比 → 失败。

若 1 与 2/3 冲突，以退出码为准。

## 错误码枚举与前端映射
当 JSON 中存在 `code` 字段时，其来源为 `linglong::utils::error::ErrorCode`。
前端可以基于该枚举做映射展示失败原因，同时保留后端 `message` 作为兜底文案。

枚举定义位置：

```
libs/utils/src/linglong/utils/error/error.h
```

建议映射（完整枚举，按类别）：

- 通用 `-1` `Failed`：通用失败
- 通用 `0` `Success`：成功
- 通用 `1` `Canceled`：操作取消
- 通用 `1000` `Unknown`：未知错误
- 通用 `1001` `AppNotFoundFromRemote`：远程仓库找不到应用
- 通用 `1002` `AppNotFoundFromLocal`：本地找不到应用
- 安装 `2001` `AppInstallFailed`：安装失败
- 安装 `2002` `AppInstallNotFoundFromRemote`：远程无该应用
- 安装 `2003` `AppInstallAlreadyInstalled`：已安装同版本
- 安装 `2004` `AppInstallNeedDowngrade`：需要降级
- 安装 `2005` `AppInstallModuleNoVersion`：安装模块时不允许指定版本
- 安装 `2006` `AppInstallModuleRequireAppFirst`：安装模块需先安装应用
- 安装 `2007` `AppInstallModuleAlreadyExists`：模块已存在
- 安装 `2008` `AppInstallArchNotMatch`：架构不匹配
- 安装 `2009` `AppInstallModuleNotFound`：远程无该模块
- 安装 `2010` `AppInstallErofsNotFound`：缺少 erofs 解压命令
- 安装 `2011` `AppInstallUnsupportedFileFormat`：不支持的文件格式
- 卸载 `2101` `AppUninstallFailed`：卸载失败
- 卸载 `2102` `AppUninstallNotFoundFromLocal`：本地无该应用
- 卸载 `2103` `AppUninstallAppIsRunning`：应用正在运行
- 卸载 `2104` `LayerCompatibilityError`：找不到兼容 layer
- 卸载 `2105` `AppUninstallMultipleVersions`：存在多版本
- 卸载 `2106` `AppUninstallBaseOrRuntime`：base/runtime 不允许卸载
- 升级 `2201` `AppUpgradeFailed`：升级失败
- 升级 `2202` `AppUpgradeLocalNotFound`：本地无可升级应用
- 网络 `3001` `NetworkError`：网络错误
- 解析/平台 `4001` `InvalidFuzzyReference`：无效引用
- 解析/平台 `4002` `UnknownArchitecture`：未知架构

实现建议：
- 若 `code` 可识别，展示对应的用户友好文案；
- 同时显示后端 `message`（可折叠为详情）；
- 若 `code` 不在枚举中，使用 `message` 原文。

## 解析与状态更新流程（建议实现步骤）
1. 启动进程：`ll-cli install <APP_ID> --json`
2. 逐行读取 stdout：
   - 尝试 JSON parse；
   - 成功后按字段归类为 `ProgressEvent` / `ErrorEvent` / `MessageEvent`；
   - 更新 UI 状态、进度条、说明文本；
   - 未解析行写入日志区，不改变状态。
3. 进度超时处理：
   - 从启动或上次 ProgressEvent 起计时 60 秒；
   - 超时即判定 `FAILED` 并终止安装流程。
4. 进程退出：
   - 退出码 `0` → `SUCCEEDED`
   - 退出码非 `0` → `FAILED`
5. 最终状态写入安装记录。

## 伪代码（语言无关）
```
state = IDLE
lastPercent = 0
lastProgressAt = now()

on_start_install():
    state = WAITING
    lastProgressAt = now()

for each line in stdout:
    if not is_json(line):
        append_log(line)
        continue
    obj = parse_json(line)

    if "code" in obj:
        state = FAILED
        show_error(obj["message"])
        continue

    if "percentage" in obj:
        lastPercent = clamp(obj["percentage"], 0, 100)
        lastProgressAt = now()
        state = INSTALLING
        show_progress(lastPercent, obj["message"])
        continue

    if "message" in obj:
        show_message(obj["message"])

timer_tick():
    if now() - lastProgressAt > 60s:
        state = FAILED
        terminate_process()

on_process_exit(code):
    if code == 0:
        state = SUCCEEDED
    else:
        state = FAILED
```

## 示例序列与期望状态
### 示例 1（成功）
输入：
```
{"message":"Beginning to install","percentage":10.0}
{"message":"Downloading files","percentage":38.4}
{"message":"Install ... success","percentage":100.0}
```
期望：
`WAITING → INSTALLING → SUCCEEDED`

### 示例 2（失败）
输入：
```
{"message":"Downloading files","percentage":40.0}
{"code":1234,"message":"Network connection failed..."}
```
期望：
`INSTALLING → FAILED`

### 示例 3（超时）
输入：
```
{"message":"Beginning to install"}
```
60 秒内无 `percentage`：
期望：
`WAITING → FAILED`

## UI 展示建议
- 主状态：等待 / 安装中 / 失败 / 成功
- 进度条：百分比 + 文本说明
- 错误：弹窗或错误栏显示 `message`（同时可显示 code 映射）

## 日志与诊断要求
- 将每条原始 JSON 行与未解析行写入日志缓冲；
- 错误发生时，保存最后 20 条日志用于问题定位；
- 若 `--json` 输出不合规，需提示 “输出格式异常”。

## 实现约束与新增需求
- **不使用 rust + pty 终端**：解析必须基于普通子进程 stdout 管道。
- **必须支持安装打断功能**：
  - 取消操作可以独立调用，不依赖安装流程内部状态；
  - 取消时立即终止 `ll-cli` 子进程，并将状态置为 `FAILED`（或单独显示“已取消”）。

## 设计模式建议（实现指导）
为保证实现清晰、可扩展、易测试，建议采用以下设计模式与分层组织：

- **State Pattern**（状态模式）
  - 用于 GUI 的 `IDLE/WAITING/INSTALLING/FAILED/SUCCEEDED` 状态切换。
  - 每个状态只处理自己关心的事件，避免 if/else 逻辑膨胀。
- **Strategy Pattern**（策略模式）
  - 解析策略可切换（例如未来新增 JSON 格式或其他命令输出）。
  - 超时策略可独立配置（60s 或不同场景不同阈值）。
- **Chain of Responsibility**（责任链）
  - 输出行解析可按顺序尝试：JSON Progress -> JSON Error -> JSON Message -> 普通文本。
  - 解析失败不影响后续处理。
- **Watchdog / Timer Monitor**（看门狗/监控）
  - 对进度事件做 60s 超时监控，独立于解析器。
  - 触发超时即发送失败事件并终止进程。

实现建议：
- 解析器只负责“把输出转换为事件”，不直接改 UI 状态。
- 状态机只消费事件并决定状态变化，便于单元测试。
- 进程管理与取消逻辑由 Command 层统一处理，避免 UI 直接杀进程。

## 验收标准
1. 1.9+ 版本：仅依赖 `message/percentage/code` 即可正确解析。
2. master 分支：输出字段变化不影响状态机。
3. 60 秒未收到 `percentage` 时，稳定进入失败状态。
4. 取消功能可独立触发，且能打断安装进程。
5. 进程退出码与状态显示一致。
