use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;

pub fn read_file(args: &HashMap<String, serde_json::Value>, project_path: &str) -> String {
    let file_path = args.get("path").and_then(|v| v.as_str()).unwrap_or("");
    let start_line = args.get("startLine").and_then(|v| v.as_u64()).map(|v| v as usize);
    let end_line = args.get("endLine").and_then(|v| v.as_u64()).map(|v| v as usize);

    let full_path = Path::new(project_path).join(file_path);

    if !full_path.exists() {
        return format!("Error: File not found: {}", file_path);
    }

    if full_path.is_dir() {
        return format!("Error: {} is a directory, not a file", file_path);
    }

    let metadata = match fs::metadata(&full_path) {
        Ok(m) => m,
        Err(e) => return format!("Error: {}", e),
    };

    // For large files with range, use streaming
    if (start_line.is_some() || end_line.is_some()) && metadata.len() > 1024 * 1024 {
        return read_range(&full_path, start_line, end_line);
    }

    let content = match fs::read_to_string(&full_path) {
        Ok(c) => c,
        Err(e) => return format!("Error reading file: {}", e),
    };

    let lines: Vec<&str> = content.lines().collect();

    if start_line.is_some() || end_line.is_some() {
        let start = start_line.unwrap_or(1).saturating_sub(1);
        let end = end_line.unwrap_or(lines.len()).min(lines.len());

        return lines[start..end]
            .iter()
            .enumerate()
            .map(|(i, line)| format!("{}: {}", start + i + 1, line))
            .collect::<Vec<_>>()
            .join("\n");
    }

    lines
        .iter()
        .enumerate()
        .map(|(i, line)| format!("{}: {}", i + 1, line))
        .collect::<Vec<_>>()
        .join("\n")
}

fn read_range(full_path: &Path, start_line: Option<usize>, end_line: Option<usize>) -> String {
    let start = start_line.unwrap_or(1);
    let end = end_line.unwrap_or(usize::MAX);

    let file = match fs::File::open(full_path) {
        Ok(f) => f,
        Err(e) => return format!("Error: {}", e),
    };

    let reader = BufReader::new(file);
    let mut result = Vec::new();

    for (line_num_0, line) in reader.lines().enumerate() {
        let line_num = line_num_0 + 1;
        if line_num > end {
            break;
        }
        if line_num >= start {
            if let Ok(line) = line {
                result.push(format!("{}: {}", line_num, line));
            }
        }
    }

    result.join("\n")
}
