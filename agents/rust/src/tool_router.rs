use crate::types::ToolExecutionResult;
use crate::tools::{search_files, read_file, write_file, list_directory, execute_command, analyze_code};
use std::collections::HashMap;
use std::time::Instant;

pub fn execute_tool(
    tool_call_id: &str,
    tool_name: &str,
    args_json: &str,
    project_path: &str,
) -> ToolExecutionResult {
    let args: HashMap<String, serde_json::Value> = match serde_json::from_str(args_json) {
        Ok(a) => a,
        Err(e) => {
            return ToolExecutionResult {
                tool_call_id: tool_call_id.to_string(),
                tool_name: tool_name.to_string(),
                result: format!("Error: Failed to parse arguments: {}", e),
                execution_time_ms: 0.0,
            };
        }
    };

    let start = Instant::now();

    let result = match tool_name {
        "search_files" => search_files::search_files(&args, project_path),
        "read_file" => read_file::read_file(&args, project_path),
        "write_file" => write_file::write_file(&args, project_path),
        "list_directory" => list_directory::list_directory(&args, project_path),
        "execute_command" => execute_command::execute_command(&args, project_path),
        "analyze_code" => analyze_code::analyze_code(&args, project_path),
        _ => format!(
            "Error: Unknown tool \"{}\". Available: search_files, read_file, write_file, list_directory, execute_command, analyze_code",
            tool_name
        ),
    };

    let elapsed = start.elapsed().as_secs_f64() * 1000.0;

    ToolExecutionResult {
        tool_call_id: tool_call_id.to_string(),
        tool_name: tool_name.to_string(),
        result,
        execution_time_ms: elapsed,
    }
}
