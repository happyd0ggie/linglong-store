mod services;

use log::LevelFilter;
use services::network::{get_network_speed as network_get_speed, NetworkSpeed};
use services::process::{get_running_linglong_apps as process_get_running_apps, kill_linglong_app as process_kill_app, LinglongAppInfo};
use services::installed::{
    get_installed_apps,
    uninstall_linglong_app,
    search_app_versions,
    run_linglong_app,
    install_linglong_app,
    InstalledApp,
};
use services::linglong::{
    search_remote_app,
    get_ll_cli_version,
    SearchResultItem,
};
use services::linglong_env::{
    check_linglong_env,
    install_linglong_env,
    LinglongEnvCheckResult,
    InstallLinglongResult,
};
pub mod modules;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn search_remote_app_cmd(app_id: String) -> Result<Vec<SearchResultItem>, String> {
    search_remote_app(app_id).await
}

#[tauri::command]
async fn get_ll_cli_version_cmd() -> Result<String, String> {
    get_ll_cli_version().await
}

#[tauri::command]
async fn check_linglong_env_cmd() -> Result<LinglongEnvCheckResult, String> {
    // 与旧版商店保持一致的最低版本要求
    const MIN_LINGLONG_VERSION: &str = "1.9.0";
    check_linglong_env(MIN_LINGLONG_VERSION).await
}

#[tauri::command]
async fn install_linglong_env_cmd(script: String) -> Result<InstallLinglongResult, String> {
    install_linglong_env(script).await
}

#[tauri::command]
async fn get_network_speed() -> Result<NetworkSpeed, String> {
    network_get_speed().await
}

#[tauri::command]
async fn get_running_linglong_apps() -> Result<Vec<LinglongAppInfo>, String> {
    process_get_running_apps().await
}

#[tauri::command]
async fn kill_linglong_app(app_name: String) -> Result<String, String> {
    process_kill_app(app_name).await
}

#[tauri::command]
async fn get_installed_linglong_apps(include_base_service: bool) -> Result<Vec<InstalledApp>, String> {
    get_installed_apps(include_base_service).await
}

#[tauri::command]
async fn uninstall_app(app_id: String, version: String) -> Result<String, String> {
    uninstall_linglong_app(app_id, version).await
}

#[tauri::command]
async fn search_versions(app_id: String) -> Result<Vec<InstalledApp>, String> {
    search_app_versions(app_id).await
}

#[tauri::command]
async fn run_app(app_id: String) -> Result<String, String> {
    run_linglong_app(app_id).await
}

#[tauri::command]
async fn install_app(
    app_handle: tauri::AppHandle,
    app_id: String,
    version: Option<String>,
    force: bool
) -> Result<String, String> {
    log::info!("[install_app] Command invoked: app_id={}, version={:?}, force={}", app_id, version, force);
    let result = install_linglong_app(app_handle, app_id.clone(), version, force).await;
    log::info!("[install_app] Command result for {}: {:?}", app_id, result);
    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(LevelFilter::Info)
                .max_file_size(10 * 1024 * 1024) // 10 MB
                // 保留所有日志文件以便于调试，不删除旧文件，最大存储10MB
                .rotation_strategy(RotationStrategy::KeepAll)
                .targets([
                    Target::new(TargetKind::LogDir {
                        file_name: Some("linglong-store".to_string()),
                    }),
                    Target::new(TargetKind::Webview),
                    Target::new(TargetKind::Stdout),
                ])
                .build(),
        )
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_zustand::init())
        .setup(|app| {
            modules::tray::setup_tray(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_network_speed,
            get_running_linglong_apps,
            kill_linglong_app,
            get_installed_linglong_apps,
            uninstall_app,
            search_versions,
            run_app,
            install_app,
            search_remote_app_cmd,
            get_ll_cli_version_cmd,
            check_linglong_env_cmd,
            install_linglong_env_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
