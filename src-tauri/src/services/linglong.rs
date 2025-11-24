use serde::{Deserialize, Serialize};
use std::process::Command;
use std::collections::HashMap;
use crate::services::ll_cli_command;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultItem {
    #[serde(alias = "id", alias = "appid", alias = "appId")]
    pub app_id: Option<String>,
    pub name: String,
    pub version: String,
    pub arch: Option<serde_json::Value>,
    pub description: Option<String>,
    pub module: Option<String>,
    pub icon: Option<String>,
}

pub async fn search_remote_app(app_id: String) -> Result<Vec<SearchResultItem>, String> {
    let output = ll_cli_command()
        .arg("search")
        .arg(&app_id)
        .arg("--json")
        .output()
        .map_err(|e| format!("Failed to execute 'll-cli search': {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        // If it's just not found or network error, we might want to return empty or error.
        // For now, return error so frontend knows.
        return Err(format!("ll-cli search command failed: {}", error_msg));
    }

    let output_string = String::from_utf8_lossy(&output.stdout);
    let trimmed = output_string.trim();
    
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    // Try parsing as a map first (e.g. {"stable": [...]})
    if let Ok(map) = serde_json::from_str::<HashMap<String, Vec<SearchResultItem>>>(trimmed) {
        let mut all_results = Vec::new();
        for (_, items) in map {
            all_results.extend(items);
        }
        return Ok(all_results);
    }

    // Fallback to array parsing
    let search_results: Vec<SearchResultItem> = serde_json::from_str(trimmed)
        .map_err(|e| format!("Failed to parse search result: {}", e))?;

    Ok(search_results)
}

pub async fn get_ll_cli_version() -> Result<String, String> {
    // Run `ll-cli --version` and return the trimmed string
    let output = ll_cli_command()
        .arg("--version")
        .output()
        .map_err(|e| format!("Failed to execute 'll-cli --version': {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ll-cli --version command failed: {}", error_msg));
    }

    let output_string = String::from_utf8_lossy(&output.stdout);
    Ok(output_string.trim().to_string())
}
