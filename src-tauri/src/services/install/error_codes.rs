//! 错误码映射
//!
//! 本模块定义了 ll-cli 错误码与用户友好消息的映射。
//! 错误码来源：linglong::utils::error::ErrorCode

/// 根据错误码获取用户友好的错误消息
pub fn get_error_status_from_code(code: i32) -> String {
    match code {
        // 通用错误
        -1 => "安装失败: 通用错误".to_string(),
        -2 => "安装失败: 进度超时".to_string(),
        
        // 用户操作
        1 => "安装已取消".to_string(),
        
        // 1000 系列：通用错误
        1000 => "安装失败: 未知错误".to_string(),
        1001 => "安装失败: 远程仓库找不到应用".to_string(),
        1002 => "安装失败: 本地找不到应用".to_string(),
        
        // 2000 系列：安装相关错误
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
        
        // 3000 系列：网络错误
        3001 => "安装失败: 网络错误".to_string(),
        
        // 4000 系列：参数错误
        4001 => "安装失败: 无效引用".to_string(),
        4002 => "安装失败: 未知架构".to_string(),
        
        // 未知错误码
        _ => format!("安装失败: 错误码 {}", code),
    }
}

/// 根据消息内容生成用户友好的状态描述
pub fn get_status_from_message(message: &str) -> String {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_codes() {
        assert_eq!(get_error_status_from_code(1), "安装已取消");
        assert_eq!(get_error_status_from_code(2003), "安装失败: 已安装同版本");
        assert_eq!(get_error_status_from_code(3001), "安装失败: 网络错误");
        assert!(get_error_status_from_code(9999).contains("9999"));
    }

    #[test]
    fn test_status_from_message() {
        assert_eq!(get_status_from_message("Beginning to install..."), "开始安装");
        assert_eq!(get_status_from_message("Downloading files..."), "正在下载文件");
        assert_eq!(get_status_from_message("success"), "安装完成");
    }
}
