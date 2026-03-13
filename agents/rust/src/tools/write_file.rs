use std::collections::HashMap;
use std::fs;
use std::path::Path;

pub fn write_file(args: &HashMap<String, serde_json::Value>, project_path: &str) -> String {
    let file_path = args.get("path").and_then(|v| v.as_str()).unwrap_or("");
    let content = args.get("content").and_then(|v| v.as_str()).unwrap_or("");

    let full_path = Path::new(project_path).join(file_path);

    if let Some(parent) = full_path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return format!("Error creating directories: {}", e);
        }
    }

    match fs::write(&full_path, content) {
        Ok(_) => format!("Written {} bytes to {}", content.len(), file_path),
        Err(e) => format!("Error writing file: {}", e),
    }
}
