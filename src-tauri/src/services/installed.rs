use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use once_cell::sync::Lazy;
use crate::services::process::kill_linglong_app;
use crate::services::ll_cli_command;

// ==================== 常量定义 ====================

/// 进度超时时间（秒）- 60秒无进度更新则判定失败
const PROGRESS_TIMEOUT_SECS: u64 = 60;

// ==================== 全局进程管理器 ====================

/// 全局进程管理器，存储正在进行的安装进程
/// 使用标准库的 Child 进程，通过 stdout 管道读取 JSON 输出
static INSTALL_PROCESSES: Lazy<Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// ==================== 安装状态机 ====================

/// 安装状态枚举
#[derive(Debug, Clone, PartialEq)]
pub enum InstallState {
    /// 空闲状态
    Idle,
    /// 等待安装（已启动进程但未收到进度百分比）
    Waiting,
    /// 安装中（已收到进度百分比）
    Installing,
    /// 安装成功
    Succeeded,
    /// 安装失败
    Failed,
}

/// 安装状态机
/// 负责管理安装过程中的状态转换
pub struct InstallStateMachine {
    pub state: InstallState,
    pub last_progress_at: Instant,
    pub last_percentage: f32,
}

impl InstallStateMachine {
    pub fn new() -> Self {
        Self {
            state: InstallState::Idle,
            last_progress_at: Instant::now(),
            last_percentage: 0.0,
        }
    }

    /// 开始安装，进入 WAITING 状态
    pub fn start(&mut self) {
        self.state = InstallState::Waiting;
        self.last_progress_at = Instant::now();
        self.last_percentage = 0.0;
        info!("[StateMachine] State: Idle -> Waiting");
    }

    /// 收到进度事件，进入/保持 INSTALLING 状态
    pub fn on_progress(&mut self, percentage: f32) {
        if self.state == InstallState::Waiting {
            info!("[StateMachine] State: Waiting -> Installing");
        }
        self.state = InstallState::Installing;
        self.last_progress_at = Instant::now();
        self.last_percentage = percentage;
    }

    /// 收到错误事件，进入 FAILED 状态
    pub fn on_error(&mut self) {
        info!("[StateMachine] State: {:?} -> Failed (ErrorEvent)", self.state);
        self.state = InstallState::Failed;
    }

    /// 进程正常退出（exit code 0），进入 SUCCEEDED 状态
    pub fn on_success(&mut self) {
        info!("[StateMachine] State: {:?} -> Succeeded", self.state);
        self.state = InstallState::Succeeded;
    }

    /// 进程异常退出或超时，进入 FAILED 状态
    pub fn on_failure(&mut self) {
        info!("[StateMachine] State: {:?} -> Failed", self.state);
        self.state = InstallState::Failed;
    }

    /// 检查是否超时（60秒无进度更新）
    pub fn check_timeout(&self) -> bool {
        if self.state == InstallState::Waiting || self.state == InstallState::Installing {
            return self.last_progress_at.elapsed().as_secs() > PROGRESS_TIMEOUT_SECS;
        }
        false
    }
}

// ==================== JSON 解析结构 ====================

/// ll-cli --json 输出的事件类型
#[derive(Debug, Clone, PartialEq)]
pub enum JsonEventType {
    /// 进度事件（包含 percentage）
    Progress,
    /// 错误事件（包含 code）
    Error,
    /// 消息事件（仅包含 message）
    Message,
}

/// ll-cli --json 输出的原始 JSON 结构
#[derive(Debug, Deserialize)]
struct LLCliJsonOutput {
    message: Option<String>,
    percentage: Option<f64>,
    code: Option<i32>,
}

/// 解析后的 JSON 事件
#[derive(Debug, Clone)]
pub struct ParsedJsonEvent {
    pub event_type: JsonEventType,
    pub message: String,
    pub percentage: Option<f32>,
    pub code: Option<i32>,
}

/// 解析 ll-cli --json 输出的单行 JSON
/// 根据字段判断事件类型：
/// - 包含 code -> ErrorEvent
/// - 包含 percentage -> ProgressEvent  
/// - 仅包含 message -> MessageEvent
pub fn parse_json_line(line: &str) -> Option<ParsedJsonEvent> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    // 尝试解析为 JSON
    let json_output: LLCliJsonOutput = match serde_json::from_str(trimmed) {
        Ok(parsed) => parsed,
        Err(e) => {
            // 非 JSON 行，记录日志但不影响状态
            warn!("[JsonParser] Non-JSON line (ignored): {} - Error: {}", trimmed, e);
            return None;
        }
    };

    let message = json_output.message.unwrap_or_default();

    // 根据字段判断事件类型
    if let Some(code) = json_output.code {
        // ErrorEvent: 包含 code 字段
        Some(ParsedJsonEvent {
            event_type: JsonEventType::Error,
            message,
            percentage: None,
            code: Some(code),
        })
    } else if let Some(pct) = json_output.percentage {
        // ProgressEvent: 包含 percentage 字段
        Some(ParsedJsonEvent {
            event_type: JsonEventType::Progress,
            message,
            percentage: Some(pct as f32),
            code: None,
        })
    } else {
        // MessageEvent: 仅包含 message
        Some(ParsedJsonEvent {
            event_type: JsonEventType::Message,
            message,
            percentage: None,
            code: None,
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub app_id: String,
    pub name: String,
    pub version: String,
    pub arch: String,
    pub channel: String,
    pub description: String,
    pub icon: String,
    pub kind: Option<String>,
    pub module: String,
    pub runtime: String,
    pub size: String,
    pub repo_name: String,
}
#[derive(Debug, Deserialize)]
struct LLCliListItem {
    #[serde(alias = "id", alias = "appid", alias = "appId")]
    app_id: Option<String>,
    name: String,
    version: String,
    arch: serde_json::Value, // 可能是字符串或数组
    channel: String,
    description: Option<String>,
    kind: Option<String>,
    module: Option<String>,
    runtime: Option<String>,
    size: Option<serde_json::Value>,
}
/// 获取已安装的玲珑应用列表
/// include_base_service: 是否包含基础服务
pub async fn get_installed_apps(include_base_service: bool) -> Result<Vec<InstalledApp>, String> {
    let mut cmd = ll_cli_command();
    cmd.arg("list").arg("--json");

    if include_base_service {
        cmd.arg("--type=all");
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute 'll-cli list': {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ll-cli list command failed: {}", error_msg));
    }
    let output_string = String::from_utf8_lossy(&output.stdout);
    let trimmed = output_string.trim();

    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    // 解析 JSON 输出
    let list_items: Vec<LLCliListItem> = serde_json::from_str(trimmed)
        .map_err(|e| format!("Failed to parse ll-cli list output: {}", e))?;
    
    // 转换为 InstalledApp 结构
    let apps: Vec<InstalledApp> = list_items
        .into_iter()
        .filter(|item| {
            if include_base_service {
                true
            } else {
                // 只保留 kind 为 "app" 的应用
                item.kind.as_ref().map_or(false, |k| k == "app")
            }
        })
        .map(|item| {
            // 处理 arch 字段，可能是字符串或数组
            let arch = match item.arch {
                serde_json::Value::String(s) => s,
                serde_json::Value::Array(arr) => {
                    arr.first()
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string()
                }
                _ => String::new(),
            };
            // 处理 size 字段
            let size = match item.size {
                Some(serde_json::Value::String(s)) => s,
                Some(serde_json::Value::Number(n)) => n.to_string(),
                _ => "0".to_string(),
            };
            InstalledApp {
                app_id: item.app_id.unwrap_or_else(|| item.name.clone()),
                name: item.name,
                version: item.version,
                arch,
                channel: item.channel,
                description: item.description.unwrap_or_default(),
                icon: String::new(), // 默认为空，后续从服务器获取
                kind: item.kind,
                module: item.module.unwrap_or_default(),
                runtime: item.runtime.unwrap_or_default(),
                size,
                repo_name: "stable".to_string(), // 默认仓库
            }
        })
        .collect();
    Ok(apps)
}

/// 卸载指定的玲珑应用
pub async fn uninstall_linglong_app(app_id: String, version: String) -> Result<String, String> {
    info!("[uninstall_linglong_app] Checking and stopping app before uninstall: {}", app_id);

    // 尝试停止运行中的应用（kill_linglong_app 内部已包含重试逻辑）
    if let Err(err) = kill_linglong_app(app_id.clone()).await {
        warn!("[uninstall_linglong_app] Failed to stop app {}: {}", app_id, err);
        return Err(format!("卸载失败，请先停止应用运行。详情: {}", err));
    }

    info!("[uninstall_linglong_app] App stopped successfully, proceeding to uninstall: {}", app_id);

    let app_ref = format!("{}/{}", app_id, version);

    let output = ll_cli_command()
        .arg("uninstall")
        .arg(&app_ref)
        .output()
        .map_err(|e| format!("Failed to execute 'll-cli uninstall': {}", e))?;
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ll-cli uninstall command failed: {}", error_msg));
    }
    Ok(format!("Successfully uninstalled {} version {}", app_id, version))
}
/// 搜索指定appId的所有已安装版本
pub async fn search_app_versions(app_id: String) -> Result<Vec<InstalledApp>, String> {
    info!("[search_app_versions] Searching for installed versions of app_id: {}", app_id);

    // 使用 ll-cli list 获取所有已安装的应用
    let output = ll_cli_command()
        .arg("list")
        .arg("--json")
        .arg("--type=all")
        .output()
        .map_err(|e| {
            let err_msg = format!("Failed to execute 'll-cli list': {}", e);
            error!("[search_app_versions] Error: {}", err_msg);
            err_msg
        })?;
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        let err = format!("ll-cli list command failed: {}", error_msg);
        error!("[search_app_versions] {}", err);
        return Err(err);
    }
    let output_string = String::from_utf8_lossy(&output.stdout);
    let trimmed = output_string.trim();

    info!("[search_app_versions] Output length: {} bytes", trimmed.len());

    if trimmed.is_empty() {
        warn!("[search_app_versions] Empty output, returning empty vec");
        return Ok(Vec::new());
    }
    // 解析 JSON 输出
    let list_items: Vec<LLCliListItem> = serde_json::from_str(trimmed)
        .map_err(|e| {
            let err_msg = format!("Failed to parse ll-cli list output: {}", e);
            error!("[search_app_versions] Parse error: {}", err_msg);
            err_msg
        })?;

    info!("[search_app_versions] Found {} installed items", list_items.len());

    // 过滤出指定 app_id 的所有版本
    let apps: Vec<InstalledApp> = list_items
        .into_iter()
        .filter(|item| {
            // 匹配 app_id 或 name
            let matches = item.app_id.as_ref().map_or(false, |id| id == &app_id)
                || item.name == app_id;
            if matches {
                info!(
                    "[search_app_versions] Found matching app: {} ({})",
                    item.name,
                    item.app_id.as_ref().unwrap_or(&item.name)
                );
            }
            matches
        })
        .map(|item| {
            let arch = match item.arch {
                serde_json::Value::String(s) => s,
                serde_json::Value::Array(arr) => {
                    arr.first()
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string()
                }
                _ => String::new(),
            };
            let size = match item.size {
                Some(serde_json::Value::String(s)) => s,
                Some(serde_json::Value::Number(n)) => n.to_string(),
                _ => "0".to_string(),
            };
            InstalledApp {
                app_id: item.app_id.unwrap_or_else(|| item.name.clone()),
                name: item.name,
                version: item.version,
                arch,
                channel: item.channel,
                description: item.description.unwrap_or_default(),
                icon: String::new(),
                kind: item.kind,
                module: item.module.unwrap_or_default(),
                runtime: item.runtime.unwrap_or_default(),
                size,
                repo_name: "stable".to_string(),
    }
        })
        .collect();
    info!("[search_app_versions] Found {} installed versions for app_id: {}", apps.len(), app_id);
    for app in &apps {
        info!(
            "[search_app_versions] - {} version: {}, channel: {}, module: {}",
            app.app_id, app.version, app.channel, app.module
        );
    }
    Ok(apps)
}
/// 运行指定的玲珑应用
pub async fn run_linglong_app(app_id: String) -> Result<String, String> {
    // 根据 ll-cli 文档，run 命令只需要应用名，不需要版本号
    // 示例：ll-cli run org.deepin.calculator

    info!("[run_linglong_app] Starting app: {}", app_id);
    info!("[run_linglong_app] Command: ll-cli run {}", app_id);

    // 在后台线程中启动命令，不等待退出
    let app_id_bg = app_id.clone();
    std::thread::spawn(move || {
        info!("[run_linglong_app][bg] Spawning ll-cli run {}", app_id_bg);
        let mut cmd = ll_cli_command();
        let spawn_result = cmd
            .arg("run")
            .arg(&app_id_bg)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
        match spawn_result
        {
            Ok(child) => {
                info!(
                    "[run_linglong_app][bg] Process spawned with PID: {:?}",
                    child.id()
                );
                // 不 wait，线程结束后让子进程自行运行
            }
            Err(e) => {
                error!(
                    "[run_linglong_app][bg] Failed to execute 'll-cli run' for {}: {}",
                    app_id_bg, e
                );
            }
        }
    });

    // 立即返回，不等待后台线程/子进程结束
    Ok(format!("Successfully launched {}", app_id))
}

// ==================== 安装进度事件 ====================

/// 安装进度事件数据结构（统一的 install-progress 事件）
/// 根据 eventType 区分不同类型的事件：
/// - "progress": 进度更新事件
/// - "error": 错误事件
/// - "message": 消息事件
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstallProgress {
    /// 应用ID
    pub app_id: String,
    /// 事件类型: "progress" | "error" | "message"
    pub event_type: String,
    /// 原始消息文本
    pub message: String,
    /// 百分比数值 (0-100)，仅 progress 事件有效
    pub percentage: u32,
    /// 状态描述（用户友好的状态文本）
    pub status: String,
    /// 错误码，仅 error 事件有效
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<i32>,
    /// 错误详情（后端原始消息），用于折叠展示
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_detail: Option<String>,
}

// ==================== 辅助函数 ====================

/// 根据消息内容生成用户友好的状态描述
fn get_status_from_message(message: &str) -> String {
    let lower = message.to_lowercase();
    
    if lower.contains("beginning to install") {
        "开始安装".to_string()
    } else if lower.contains("installing application") {
        "正在安装应用".to_string()
    } else if lower.contains("installing runtime") {
        "正在安装运行时".to_string()
    } else if lower.contains("installing base") {
        "正在安装基础包".to_string()
    } else if lower.contains("downloading metadata") {
        "正在下载元数据".to_string()
    } else if lower.contains("downloading files") || lower.contains("downloading") {
        "正在下载文件".to_string()
    } else if lower.contains("processing after install") {
        "安装后处理".to_string()
    } else if lower.contains("success") {
        "安装完成".to_string()
    } else if !message.is_empty() {
        // 截取前50个字符作为状态
        if message.len() > 50 {
            format!("{}...", &message[..50])
        } else {
            message.to_string()
        }
    } else {
        "正在处理".to_string()
    }
}

/// 根据错误码获取用户友好的错误消息
fn get_error_status_from_code(code: i32) -> String {
    match code {
        -1 => "安装失败: 通用错误".to_string(),
        1 => "安装已取消".to_string(),
        1000 => "安装失败: 未知错误".to_string(),
        1001 => "安装失败: 远程仓库找不到应用".to_string(),
        1002 => "安装失败: 本地找不到应用".to_string(),
        2001 => "安装失败".to_string(),
        2002 => "安装失败: 远程无该应用".to_string(),
        2003 => "安装失败: 已安装同版本".to_string(),
        2004 => "安装失败: 需要降级安装".to_string(),
        2005 => "安装失败: 安装模块时不允许指定版本".to_string(),
        2006 => "安装失败: 安装模块需先安装应用".to_string(),
        2007 => "安装失败: 模块已存在".to_string(),
        2008 => "安装失败: 架构不匹配".to_string(),
        2009 => "安装失败: 远程无该模块".to_string(),
        2010 => "安装失败: 缺少 erofs 解压命令".to_string(),
        2011 => "安装失败: 不支持的文件格式".to_string(),
        3001 => "安装失败: 网络错误".to_string(),
        4001 => "安装失败: 无效引用".to_string(),
        4002 => "安装失败: 未知架构".to_string(),
        _ => format!("安装失败: 错误码 {}", code),
    }
}

/// 安装指定的玲珑应用（使用 --json 模式）
/// 
/// 实现基于 ll-cli-json-install-gui-requirements.md 的状态机模型：
/// - IDLE -> WAITING: 启动安装
/// - WAITING -> INSTALLING: 收到进度百分比
/// - INSTALLING/WAITING -> FAILED: 收到错误/超时/进程异常退出
/// - INSTALLING -> SUCCEEDED: 进程正常退出 (exit code 0)
/// 
/// 参数说明：
/// - app_handle: Tauri 应用句柄，用于发送进度事件
/// - app_id: 应用 ID（例如：org.deepin.calculator）
/// - version: 可选的版本号（如果为空，则安装最新版本）
/// - force: 是否强制安装
pub async fn install_linglong_app(
    app_handle: AppHandle,
    app_id: String,
    version: Option<String>,
    force: bool,
) -> Result<String, String> {
    info!("========== [install_linglong_app] START (JSON mode) ==========");
    info!("[install_linglong_app] app_id: {}", app_id);
    info!("[install_linglong_app] version: {:?}", version);
    info!("[install_linglong_app] force: {}", force);

    // 构建应用引用
    let app_ref = if let Some(ver) = version.as_ref() {
        format!("{}/{}", app_id, ver)
    } else {
        app_id.clone()
    };

    // 构建命令：ll-cli install <app_ref> --json -y [--force]
    let mut cmd = ll_cli_command();
    cmd.arg("install");
    cmd.arg(&app_ref);
    cmd.arg("--json");  // 使用 JSON 输出模式
    cmd.arg("-y");      // 自动确认

    if force {
        cmd.arg("--force");
    }

    // 配置 stdout 为管道以捕获输出
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let command_str = format!(
        "ll-cli install {} --json -y{}",
        app_ref,
        if force { " --force" } else { "" }
    );
    info!("[install_linglong_app] Executing command: {}", command_str);

    // 启动子进程
    let mut child = cmd.spawn().map_err(|e| {
        let err_msg = format!("Failed to spawn ll-cli process: {}", e);
        error!("[install_linglong_app] ERROR: {}", err_msg);
        err_msg
    })?;

    info!("[install_linglong_app] Process spawned successfully");

    // 获取 stdout 用于读取 JSON 输出
    let stdout = child.stdout.take().ok_or_else(|| {
        "Failed to capture stdout".to_string()
    })?;

    // 初始化状态机
    let state_machine = Arc::new(Mutex::new(InstallStateMachine::new()));
    
    // 将进程存储到全局管理器中，以便可以取消
    let child_arc = Arc::new(Mutex::new(child));
    {
        let mut processes = INSTALL_PROCESSES.lock().map_err(|e| {
            format!("Failed to lock process manager: {}", e)
        })?;
        
        info!("[install_linglong_app] Storing process with app_id: '{}'", app_id);
        processes.insert(app_id.clone(), child_arc.clone());
        info!("[install_linglong_app] Process stored. Total processes: {}", processes.len());
    }

    // 启动状态机
    {
        let mut sm = state_machine.lock().map_err(|e| format!("Lock error: {}", e))?;
        sm.start();
    }

    // 发送初始等待事件
    let _ = app_handle.emit("install-progress", &InstallProgress {
        app_id: app_id.clone(),
        event_type: "message".to_string(),
        message: "Starting installation...".to_string(),
        percentage: 0,
        status: "等待安装".to_string(),
        code: None,
        error_detail: None,
    });

    // 在单独的线程中读取 stdout JSON 输出
    let app_id_clone = app_id.clone();
    let app_handle_clone = app_handle.clone();
    let state_machine_clone = state_machine.clone();
    let last_error: Arc<Mutex<Option<(i32, String)>>> = Arc::new(Mutex::new(None));
    let last_error_clone = last_error.clone();

    let reader_handle = std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        let mut last_percentage: u32 = 0;

        for line_result in reader.lines() {
            let line = match line_result {
                Ok(l) => l,
                Err(e) => {
                    warn!("[JsonReader] Error reading line: {}", e);
                    continue;
                }
            };

            info!("[JsonReader] Raw line: {}", line);

            // 解析 JSON 行
            let event = match parse_json_line(&line) {
                Some(e) => e,
                None => continue,  // 非 JSON 行，跳过
            };

            info!("[JsonReader] Parsed event: {:?}", event);

            match event.event_type {
                JsonEventType::Progress => {
                    // 更新状态机
                    if let Ok(mut sm) = state_machine_clone.lock() {
                        sm.on_progress(event.percentage.unwrap_or(0.0));
                    }

                    let percentage = event.percentage.unwrap_or(0.0) as u32;
                    let percentage = percentage.min(100);  // clamp to 100

                    // 只有当百分比变化时才发送事件
                    if percentage != last_percentage {
                        last_percentage = percentage;
                        
                        let status = get_status_from_message(&event.message);
                        
                        let progress_event = InstallProgress {
                            app_id: app_id_clone.clone(),
                            event_type: "progress".to_string(),
                            message: event.message.clone(),
                            percentage,
                            status,
                            code: None,
                            error_detail: None,
                        };

                        info!("[JsonReader] Emitting progress: {}%", percentage);
                        let _ = app_handle_clone.emit("install-progress", &progress_event);
                    }
                }
                JsonEventType::Error => {
                    // 更新状态机
                    if let Ok(mut sm) = state_machine_clone.lock() {
                        sm.on_error();
                    }

                    let code = event.code.unwrap_or(-1);
                    let status = get_error_status_from_code(code);

                    // 保存最后的错误信息
                    if let Ok(mut last_err) = last_error_clone.lock() {
                        *last_err = Some((code, event.message.clone()));
                    }

                    let error_event = InstallProgress {
                        app_id: app_id_clone.clone(),
                        event_type: "error".to_string(),
                        message: event.message.clone(),
                        percentage: 0,
                        status,
                        code: Some(code),
                        error_detail: Some(event.message.clone()),
                    };

                    error!("[JsonReader] Emitting error: code={}, message={}", code, event.message);
                    let _ = app_handle_clone.emit("install-progress", &error_event);
                }
                JsonEventType::Message => {
                    // 消息事件仅用于日志和提示，不改变状态
                    let status = get_status_from_message(&event.message);
                    
                    let message_event = InstallProgress {
                        app_id: app_id_clone.clone(),
                        event_type: "message".to_string(),
                        message: event.message.clone(),
                        percentage: last_percentage,
                        status,
                        code: None,
                        error_detail: None,
                    };

                    info!("[JsonReader] Emitting message: {}", event.message);
                    let _ = app_handle_clone.emit("install-progress", &message_event);
                }
            }
        }

        info!("[JsonReader] Finished reading stdout");
    });

    info!("[install_linglong_app] Waiting for process to complete...");

    // 使用轮询方式等待进程结束，同时检查超时
    let exit_status = loop {
        // 检查进程状态
        let status = {
            let mut child = child_arc.lock().map_err(|e| {
                format!("Failed to lock child process: {}", e)
            })?;

            match child.try_wait() {
                Ok(Some(status)) => {
                    info!("[install_linglong_app] Process exited with status: {:?}", status);
                    Some(status)
                }
                Ok(None) => None,  // 进程还在运行
                Err(e) => {
                    let err_msg = format!("Failed to check process status: {}", e);
                    error!("[install_linglong_app] ERROR: {}", err_msg);
                    return Err(err_msg);
                }
            }
        };

        // 检查超时 (60秒无进度更新)
        {
            let sm = state_machine.lock().map_err(|e| format!("Lock error: {}", e))?;
            if sm.check_timeout() {
                warn!("[install_linglong_app] Progress timeout (>60s). Killing process...");
                
                // 终止进程
                if let Ok(mut child) = child_arc.lock() {
                    let _ = child.kill();
                }

                // 发送超时错误事件
                let _ = app_handle.emit("install-progress", &InstallProgress {
                    app_id: app_id.clone(),
                    event_type: "error".to_string(),
                    message: "Installation timed out: no progress for 60 seconds".to_string(),
                    percentage: 0,
                    status: "安装失败: 进度超时".to_string(),
                    code: Some(-2),
                    error_detail: Some("60秒内未收到进度更新，安装已超时".to_string()),
                });

                return Err("Installation timed out".to_string());
            }
        }

        if let Some(status) = status {
            break status;
        }

        // 短暂休眠后再次检查
        std::thread::sleep(std::time::Duration::from_millis(100));
    };

    // 从全局管理器中移除进程
    {
        let mut processes = INSTALL_PROCESSES.lock().map_err(|e| {
            format!("Failed to lock process manager: {}", e)
        })?;
        processes.remove(&app_id);
        info!("[install_linglong_app] Process removed from manager for app: {}", app_id);
    }

    // 等待读取线程完成
    let _ = reader_handle.join();

    info!("==========================================================");
    info!("[install_linglong_app] Process exited with status: {:?}", exit_status);

    // 根据退出码判断最终状态（退出码是最终裁决）
    if exit_status.success() {
        // 更新状态机
        if let Ok(mut sm) = state_machine.lock() {
            sm.on_success();
        }

        let success_msg = if let Some(ver) = version {
            format!("Successfully installed {} version {}", app_id, ver)
        } else {
            format!("Successfully installed {}", app_id)
        };

        info!("[install_linglong_app] SUCCESS: {}", success_msg);

        // 发送完成事件
        let _ = app_handle.emit("install-progress", &InstallProgress {
            app_id: app_id.clone(),
            event_type: "progress".to_string(),
            message: "Installation completed successfully".to_string(),
            percentage: 100,
            status: "安装完成".to_string(),
            code: None,
            error_detail: None,
        });

        info!("========== [install_linglong_app] END ==========");
        Ok(success_msg)
    } else {
        // 更新状态机
        if let Ok(mut sm) = state_machine.lock() {
            sm.on_failure();
        }

        // 获取之前保存的错误信息
        let (error_code, error_message) = if let Ok(last_err) = last_error.lock() {
            last_err.clone().unwrap_or((-1, "Unknown error".to_string()))
        } else {
            (-1, "Unknown error".to_string())
        };

        let status = get_error_status_from_code(error_code);
        let failure_msg = format!("Installation failed: {}", error_message);

        error!("[install_linglong_app] FAILED: {}", failure_msg);

        // 发送失败事件
        let _ = app_handle.emit("install-progress", &InstallProgress {
            app_id: app_id.clone(),
            event_type: "error".to_string(),
            message: error_message.clone(),
            percentage: 0,
            status,
            code: Some(error_code),
            error_detail: Some(error_message),
        });

        info!("========== [install_linglong_app] END ==========");
        Err(failure_msg)
    }
}

/// 取消正在进行的安装
/// 
/// 此函数可独立调用，不依赖安装流程内部状态。
/// 会立即终止 ll-cli 子进程并发送取消事件。
/// 
/// 参数说明：
/// - app_handle: Tauri 应用句柄，用于发送取消事件
/// - app_id: 要取消安装的应用 ID
/// 
/// 返回：
/// - Ok(String): 取消成功的消息
/// - Err(String): 取消失败的原因（如进程不存在）
pub async fn cancel_linglong_install(
    app_handle: AppHandle,
    app_id: String,
) -> Result<String, String> {
    info!("[cancel_linglong_install] Cancelling installation for app: {}", app_id);

    // 从全局管理器中获取进程
    let child_arc = {
        let processes = INSTALL_PROCESSES.lock().map_err(|e| {
            format!("Failed to lock process manager: {}", e)
        })?;

        info!("[cancel_linglong_install] Current processes: {}", processes.len());
        for key in processes.keys() {
            info!("[cancel_linglong_install]   - '{}'", key);
        }

        match processes.get(&app_id) {
            Some(child) => child.clone(),
            None => {
                warn!("[cancel_linglong_install] No installation process found for app: {}", app_id);
                return Err(format!("No installation in progress for {}", app_id));
            }
        }
    };

    // 终止进程（使用 pkexec 获取管理员权限强制杀死）
    let kill_result = {
        let child = child_arc.lock().map_err(|e| {
            format!("Failed to lock child process: {}", e)
        })?;

        let pid = child.id();
        info!("[cancel_linglong_install] Killing process (PID: {}) for app: {}", pid, app_id);
        
        // Unix 系统使用 pkexec kill -9 强制杀死进程组
        #[cfg(unix)]
        {
            if pid > 0 {
                // 使用 pkexec kill -9 -<pid> 杀死整个进程组
                // 负号表示进程组 ID（PGID = PID，因为我们在启动时调用了 setpgid(0, 0)）
                let pgid = pid as i32;
                let pgid_arg = format!("-{}", pgid);
                
                info!("[cancel_linglong_install] Executing: pkexec kill -9 {}", pgid_arg);
                
                let output = std::process::Command::new("pkexec")
                    .arg("kill")
                    .arg("-9")
                    .arg(&pgid_arg)
                    .output();
                
                match output {
                    Ok(out) => {
                        if out.status.success() {
                            info!("[cancel_linglong_install] Process group {} killed successfully", pgid);
                            Ok(())
                        } else {
                            let stderr = String::from_utf8_lossy(&out.stderr);
                            error!("[cancel_linglong_install] pkexec kill failed: {}", stderr);
                            Err(format!("无法终止安装进程: {}", stderr))
                        }
                    }
                    Err(e) => {
                        error!("[cancel_linglong_install] Failed to execute pkexec: {}", e);
                        Err(format!("无法执行 pkexec 命令: {}. 请确保系统已安装 polkit", e))
                    }
                }
            } else {
                error!("[cancel_linglong_install] Invalid PID: {}", pid);
                Err("无效的进程 ID".to_string())
            }
        }
        
        // 非 Unix 系统使用标准 kill() 方法
        #[cfg(not(unix))]
        {
            drop(child);
            let mut child_mut = child_arc.lock().map_err(|e| {
                format!("Failed to lock child process: {}", e)
            })?;
            
            match child_mut.kill() {
                Ok(_) => {
                    info!("[cancel_linglong_install] Process killed successfully");
                    Ok(())
                }
                Err(e) => {
                    error!("[cancel_linglong_install] Failed to kill process: {}", e);
                    Err(format!("无法终止安装进程: {}", e))
                }
            }
        }
    };

    // 如果终止失败，返回错误
    if let Err(err) = kill_result {
        warn!("[cancel_linglong_install] Cancel failed: {}", err);
        return Err(err);
    }

    // 从全局管理器中移除进程
    {
        let mut processes = INSTALL_PROCESSES.lock().map_err(|e| {
            format!("Failed to lock process manager: {}", e)
        })?;
        processes.remove(&app_id);
        info!("[cancel_linglong_install] Process removed from manager for app: {}", app_id);
    }

    // 发送取消事件
    let _ = app_handle.emit("install-progress", &InstallProgress {
        app_id: app_id.clone(),
        event_type: "error".to_string(),
        message: "Installation cancelled by user".to_string(),
        percentage: 0,
        status: "安装已取消".to_string(),
        code: Some(1),  // 1 = Cancelled (根据错误码枚举)
        error_detail: Some("用户取消了安装操作".to_string()),
    });

    let success_msg = format!("Installation of {} cancelled successfully", app_id);
    info!("[cancel_linglong_install] {}", success_msg);
    Ok(success_msg)
}
