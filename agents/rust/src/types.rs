use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub role: String,
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: FunctionCall,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Serialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<Message>,
    pub tools: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct ChatCompletionResponse {
    pub choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
pub struct Choice {
    pub message: Message,
    pub finish_reason: String,
}

pub struct ToolExecutionResult {
    pub tool_call_id: String,
    pub tool_name: String,
    pub result: String,
    pub execution_time_ms: f64,
}

#[derive(Debug, Serialize)]
pub struct TimingData {
    pub agent_total_ms: f64,
    pub api_calls: u32,
    pub tool_executions: HashMap<String, ToolTimingDetails>,
}

#[derive(Debug, Serialize)]
pub struct ToolTimingDetails {
    pub count: u32,
    pub total_ms: f64,
    pub times_ms: Vec<f64>,
}
