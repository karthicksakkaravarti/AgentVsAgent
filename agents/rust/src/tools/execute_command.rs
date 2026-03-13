use std::collections::HashMap;
use std::process::Command;
use std::time::Duration;

pub fn execute_command(args: &HashMap<String, serde_json::Value>, project_path: &str) -> String {
    let command = args.get("command").and_then(|v| v.as_str()).unwrap_or("");
    let _timeout_ms = args.get("timeout").and_then(|v| v.as_u64()).unwrap_or(30000);

    let output = Command::new("sh")
        .arg("-c")
        .arg(command)
        .current_dir(project_path)
        .output();

    match output {
        Ok(output) => {
            let exit_code = output.status.code().unwrap_or(-1);
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            format!("Exit code: {}\nStdout:\n{}\nStderr:\n{}", exit_code, stdout, stderr)
        }
        Err(e) => format!("Exit code: -1\nError: {}", e),
    }
}
