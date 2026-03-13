use regex::Regex;
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;

pub fn search_files(args: &HashMap<String, serde_json::Value>, project_path: &str) -> String {
    let pattern = args.get("pattern").and_then(|v| v.as_str()).unwrap_or("");
    let search_path = args.get("path").and_then(|v| v.as_str()).unwrap_or(".");
    let include = args.get("include").and_then(|v| v.as_str());
    let max_results = args.get("maxResults").and_then(|v| v.as_u64()).unwrap_or(100) as usize;

    let regex = match Regex::new(pattern) {
        Ok(r) => r,
        Err(e) => return format!("Error: Invalid regex: {}", e),
    };

    let full_path = Path::new(project_path).join(search_path);
    let mut matches = Vec::new();

    let include_regex = include.and_then(|g| {
        let re_str = glob_to_regex(g);
        Regex::new(&re_str).ok()
    });

    walk_and_search(&full_path, &regex, &include_regex, project_path, &mut matches, max_results);

    if matches.is_empty() {
        return format!("No matches found for pattern \"{}\" in {}", pattern, search_path);
    }

    matches.join("\n")
}

fn walk_and_search(
    dir: &Path,
    regex: &Regex,
    include_regex: &Option<Regex>,
    project_root: &str,
    matches: &mut Vec<String>,
    max_results: usize,
) {
    if matches.len() >= max_results {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        if matches.len() >= max_results {
            return;
        }

        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            if name == "node_modules" || name == ".git" {
                continue;
            }
            walk_and_search(&path, regex, include_regex, project_root, matches, max_results);
        } else if path.is_file() {
            if let Some(ref inc) = include_regex {
                if !inc.is_match(&name) {
                    continue;
                }
            }

            if let Ok(file) = fs::File::open(&path) {
                let reader = BufReader::new(file);
                let rel_path = path.strip_prefix(project_root).unwrap_or(&path);

                for (line_num, line) in reader.lines().enumerate() {
                    if matches.len() >= max_results {
                        return;
                    }
                    if let Ok(line) = line {
                        if regex.is_match(&line) {
                            matches.push(format!(
                                "{}:{}: {}",
                                rel_path.display(),
                                line_num + 1,
                                line.trim()
                            ));
                        }
                    }
                }
            }
        }
    }
}

fn glob_to_regex(glob: &str) -> String {
    let mut result = String::from("^");
    for c in glob.chars() {
        match c {
            '*' => result.push_str(".*"),
            '?' => result.push('.'),
            '.' | '+' | '^' | '$' | '{' | '}' | '(' | ')' | '|' | '[' | ']' | '\\' => {
                result.push('\\');
                result.push(c);
            }
            _ => result.push(c),
        }
    }
    result.push('$');
    result
}
