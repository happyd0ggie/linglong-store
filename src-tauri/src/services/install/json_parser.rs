//! JSON 解析器
//!
//! 本模块负责解析 ll-cli --json 输出的 JSON 数据。

use log::warn;
use serde::Deserialize;

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

/// JSON 行解析器
///
/// 负责解析 ll-cli --json 输出的单行 JSON，
/// 根据字段判断事件类型：
/// - 包含 code -> ErrorEvent
/// - 包含 percentage -> ProgressEvent
/// - 仅包含 message -> MessageEvent
pub struct JsonLineParser;

impl JsonLineParser {
    /// 解析单行 JSON
    ///
    /// # Arguments
    /// * `line` - 待解析的 JSON 行
    ///
    /// # Returns
    /// * `Some(ParsedJsonEvent)` - 解析成功
    /// * `None` - 空行或非 JSON 行
    pub fn parse(line: &str) -> Option<ParsedJsonEvent> {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return None;
        }

        // 尝试解析为 JSON
        let json_output: LLCliJsonOutput = match serde_json::from_str(trimmed) {
            Ok(parsed) => parsed,
            Err(e) => {
                // 非 JSON 行，记录日志但不影响状态
                warn!(
                    "[JsonParser] Non-JSON line (ignored): {} - Error: {}",
                    trimmed, e
                );
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_progress_event() {
        let line = r#"{"message":"Downloading files","percentage":38.4}"#;
        let event = JsonLineParser::parse(line).unwrap();
        assert_eq!(event.event_type, JsonEventType::Progress);
        assert_eq!(event.message, "Downloading files");
        assert!((event.percentage.unwrap() - 38.4).abs() < 0.1);
        assert!(event.code.is_none());
    }

    #[test]
    fn test_parse_error_event() {
        let line = r#"{"code":3001,"message":"Network connection failed"}"#;
        let event = JsonLineParser::parse(line).unwrap();
        assert_eq!(event.event_type, JsonEventType::Error);
        assert_eq!(event.message, "Network connection failed");
        assert_eq!(event.code, Some(3001));
        assert!(event.percentage.is_none());
    }

    #[test]
    fn test_parse_message_event() {
        let line = r#"{"message":"Install success"}"#;
        let event = JsonLineParser::parse(line).unwrap();
        assert_eq!(event.event_type, JsonEventType::Message);
        assert_eq!(event.message, "Install success");
        assert!(event.code.is_none());
        assert!(event.percentage.is_none());
    }

    #[test]
    fn test_parse_empty_line() {
        assert!(JsonLineParser::parse("").is_none());
        assert!(JsonLineParser::parse("   ").is_none());
    }

    #[test]
    fn test_parse_non_json_line() {
        assert!(JsonLineParser::parse("This is not JSON").is_none());
    }
}
