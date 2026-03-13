use std::collections::HashMap;
use std::fs;
use std::path::Path;

pub fn list_directory(args: &HashMap<String, serde_json::Value>, project_path: &str) -> String {
    let dir_path = args.get("path").and_then(|v| v.as_str()).unwrap_or(".");
    let recursive = args.get("recursive").and_then(|v| v.as_bool()).unwrap_or(false);
    let max_depth = args.get("maxDepth").and_then(|v| v.as_u64()).unwrap_or(3) as usize;

    let full_path = Path::new(project_path).join(dir_path);

    if !full_path.exists() {
        return format!("Error: Directory not found: {}", dir_path);
    }
    if !full_path.is_dir() {
        return format!("Error: {} is not a directory", dir_path);
    }

    let mut entries = Vec::new();
    list_dir(&full_path, &mut entries, recursive, max_depth, 0);

    if entries.is_empty() {
        return format!("Directory {} is empty", dir_path);
    }

    entries.join("\n")
}

fn list_dir(dir: &Path, entries: &mut Vec<String>, recursive: bool, max_depth: usize, depth: usize) {
    let indent = "  ".repeat(depth);

    let dir_entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let mut items: Vec<_> = dir_entries.flatten().collect();
    items.sort_by_key(|e| e.file_name());

    for entry in items {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            let child_count = fs::read_dir(&path).map(|e| e.count()).unwrap_or(0);
            entries.push(format!("{}[DIR]  {}/ ({} items)", indent, name, child_count));

            if recursive && depth < max_depth {
                list_dir(&path, entries, recursive, max_depth, depth + 1);
            }
        } else {
            let size = entry.metadata().map(|m| format_size(m.len())).unwrap_or_default();
            entries.push(format!("{}[FILE] {} ({})", indent, name, size));
        }
    }
}

fn format_size(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{}B", bytes)
    } else if bytes < 1024 * 1024 {
        format!("{:.1}KB", bytes as f64 / 1024.0)
    } else {
        format!("{:.1}MB", bytes as f64 / (1024.0 * 1024.0))
    }
}
