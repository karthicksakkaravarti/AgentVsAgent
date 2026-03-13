use crate::types::{ChatCompletionRequest, Message};

pub struct ApiClient {
    base_url: String,
    session_id: String,
}

impl ApiClient {
    pub fn new(base_url: String, session_id: String) -> Self {
        Self { base_url, session_id }
    }

    pub fn send_chat_completion(
        &self,
        messages: &[Message],
        tools: &serde_json::Value,
    ) -> Result<String, String> {
        let request = ChatCompletionRequest {
            model: "gpt-4".to_string(),
            messages: messages.to_vec(),
            tools: tools.clone(),
        };

        let body = serde_json::to_string(&request)
            .map_err(|e| format!("serialize request: {}", e))?;

        let url = format!("{}/v1/chat/completions", self.base_url);

        let resp = ureq::post(&url)
            .set("Content-Type", "application/json")
            .set("Authorization", &format!("Bearer {}", self.session_id))
            .set("X-Session-Id", &self.session_id)
            .send_string(&body)
            .map_err(|e| format!("send request: {}", e))?;

        resp.into_string()
            .map_err(|e| format!("read response: {}", e))
    }
}
