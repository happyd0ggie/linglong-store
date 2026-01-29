use log::{error, info, warn};
use crate::services::ll_cli_command;

/// 清理废弃的基础服务
/// 调用 ll-cli prune 命令
pub async fn prune_linglong_apps() -> Result<String, String> {
    info!("[prune_linglong_apps] Starting prune operation");

    let mut cmd = ll_cli_command();
    cmd.arg("prune");

    let output = cmd
        .output()
        .map_err(|e| {
            error!("[prune_linglong_apps] Failed to execute ll-cli prune: {}", e);
            format!("执行 ll-cli prune 失败: {}", e)
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    info!("[prune_linglong_apps] stdout: {}", stdout);
    if !stderr.is_empty() {
        warn!("[prune_linglong_apps] stderr: {}", stderr);
    }

    if output.status.success() {
        let message = if stdout.trim().is_empty() {
            "清理完成".to_string()
        } else {
            stdout.trim().to_string()
        };
        info!("[prune_linglong_apps] Prune completed successfully: {}", message);
        Ok(message)
    } else {
        let error_msg = if !stderr.is_empty() {
            stderr.trim().to_string()
        } else {
            "清理失败".to_string()
        };
        error!("[prune_linglong_apps] Prune failed: {}", error_msg);
        Err(error_msg)
    }
}
