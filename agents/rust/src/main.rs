//! Block 5: Orchestration Loop (The Engine / ReAct Loop) — Rust Agent
//!
//! Entry point that ties all 5 building blocks together.

mod api_client;
mod tool_router;
mod tools;
mod types;

use api_client::ApiClient;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::time::Instant;
use types::{ChatCompletionResponse, Message, TimingData, ToolTimingDetails};

fn main() {
    let agent_start = Instant::now();

    // Environment configuration
    let api_url = env::var("MOCK_API_URL").unwrap_or_else(|_| "http://localhost:8080".to_string());
    let session_id = env::var("SESSION_ID").unwrap_or_else(|_| {
        format!(
            "rust-agent-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        )
    });
    let project_path = env::var("PROJECT_PATH").unwrap_or_else(|_| {
        "../../target-project/generated".to_string()
    });

    println!("=== Rust Agent Starting ===");
    println!("  API: {}", api_url);
    println!("  Session: {}", session_id);
    println!("  Project: {}", project_path);
    println!();

    // Block 1: Load system prompt
    let prompt_paths = vec![
        PathBuf::from("../../agents/spec/system-prompt.txt"),
        PathBuf::from("../spec/system-prompt.txt"),
    ];
    let system_prompt_template = prompt_paths
        .iter()
        .find_map(|p| fs::read_to_string(p).ok())
        .expect("Failed to read system prompt");
    let system_prompt = system_prompt_template.replace("{PROJECT_PATH}", &project_path);

    let user_prompt = format!(
        "The project at {} has several bugs causing production errors. \
         Find and fix all of them. Start by examining the error logs in the logs/ directory.",
        project_path
    );

    // Load tools schema
    let tools_paths = vec![
        PathBuf::from("../../agents/spec/tools-schema.json"),
        PathBuf::from("../spec/tools-schema.json"),
    ];
    let tools_json = tools_paths
        .iter()
        .find_map(|p| fs::read_to_string(p).ok())
        .expect("Failed to read tools schema");
    let tools_schema: serde_json::Value = serde_json::from_str(&tools_json).unwrap();
    let tools = tools_schema.get("tools").cloned().unwrap_or(serde_json::Value::Array(vec![]));

    // Block 2: Initialize state
    let mut messages: Vec<Message> = vec![
        Message {
            role: "system".to_string(),
            content: Some(system_prompt),
            tool_calls: None,
            tool_call_id: None,
        },
        Message {
            role: "user".to_string(),
            content: Some(user_prompt),
            tool_calls: None,
            tool_call_id: None,
        },
    ];

    // API client
    let client = ApiClient::new(api_url, session_id);

    // Timing data
    let mut timing = TimingData {
        agent_total_ms: 0.0,
        api_calls: 0,
        tool_executions: HashMap::new(),
    };

    // Block 5: Orchestration loop
    let max_steps = 200;
    for step in 1..=max_steps {
        let msg_size = serde_json::to_string(&messages).map(|s| s.len()).unwrap_or(0);
        println!(
            "[Step {}] Sending request to API ({} messages, ~{}KB)...",
            step,
            messages.len(),
            msg_size / 1024
        );

        // Send state to API (Reason)
        let resp_body = match client.send_chat_completion(&messages, &tools) {
            Ok(body) => body,
            Err(e) => {
                eprintln!("[Step {}] API error: {}", step, e);
                break;
            }
        };
        timing.api_calls += 1;

        // Block 3: Parse response (Interpret)
        let resp: ChatCompletionResponse = match serde_json::from_str(&resp_body) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[Step {}] Parse error: {}", step, e);
                break;
            }
        };

        if resp.choices.is_empty() {
            eprintln!("[Step {}] No choices in response", step);
            break;
        }

        let choice = &resp.choices[0];

        if choice.finish_reason == "stop" {
            println!("[Step {}] Final answer received.", step);
            println!();
            println!("=== Agent Summary ===");
            if let Some(ref content) = choice.message.content {
                let preview = if content.len() > 500 { &content[..500] } else { content };
                println!("{}", preview);
            }
            break;
        }

        if choice.finish_reason == "tool_calls" {
            // Add assistant message to state
            messages.push(choice.message.clone());

            // Block 4: Execute tools (Act)
            if let Some(ref tool_calls) = choice.message.tool_calls {
                for tc in tool_calls {
                    let args_preview = if tc.function.arguments.len() > 80 {
                        &tc.function.arguments[..80]
                    } else {
                        &tc.function.arguments
                    };
                    println!("  [Tool] {}({}...)", tc.function.name, args_preview);

                    let result = tool_router::execute_tool(
                        &tc.id,
                        &tc.function.name,
                        &tc.function.arguments,
                        &project_path,
                    );

                    // Record timing
                    let entry = timing
                        .tool_executions
                        .entry(result.tool_name.clone())
                        .or_insert_with(|| ToolTimingDetails {
                            count: 0,
                            total_ms: 0.0,
                            times_ms: vec![],
                        });
                    entry.count += 1;
                    entry.total_ms += result.execution_time_ms;
                    entry.times_ms.push((result.execution_time_ms * 100.0).round() / 100.0);

                    println!(
                        "  [Tool] {} completed in {:.1}ms ({} chars)",
                        result.tool_name,
                        result.execution_time_ms,
                        result.result.len()
                    );

                    // Add tool result to state (Observe)
                    messages.push(Message {
                        role: "tool".to_string(),
                        tool_call_id: Some(tc.id.clone()),
                        content: Some(result.result),
                        tool_calls: None,
                    });
                }
            }
        }
    }

    // Output timing data
    timing.agent_total_ms = (agent_start.elapsed().as_secs_f64() * 1000.0 * 100.0).round() / 100.0;

    println!();
    println!(
        "=== Agent completed in {:.2}s ({} API calls) ===",
        timing.agent_total_ms / 1000.0,
        timing.api_calls
    );
    println!("{}", serde_json::to_string(&timing).unwrap());
}
