use ignore::{WalkBuilder, WalkState};
use regex::Regex;
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{mpsc, Arc};

pub fn search_files(args: &HashMap<String, serde_json::Value>, project_path: &str) -> String {
    let pattern = args.get("pattern").and_then(|v| v.as_str()).unwrap_or("");
    let search_path = args.get("path").and_then(|v| v.as_str()).unwrap_or(".");
    let include = args.get("include").and_then(|v| v.as_str());
    let max_results = args.get("maxResults").and_then(|v| v.as_u64()).unwrap_or(100) as usize;

    let regex = match Regex::new(pattern) {
        Ok(r) => r,
        Err(e) => return format!("Error: Invalid regex: {}", e),
    };

    let include_regex = include.and_then(|g| Regex::new(&glob_to_regex(g)).ok());

    let full_path = Path::new(project_path).join(search_path);

    // Channel to collect matches asynchronously from all worker threads
    let (tx, rx) = mpsc::channel();
    
    // Thread-safe atomic counter for early exit across all threads
    let match_count = Arc::new(AtomicUsize::new(0));

    // Initialize the parallel walker
    let walker = WalkBuilder::new(&full_path)
        .hidden(true)      // Respect hidden files
        .ignore(true)      // Respect .ignore files
        .git_ignore(true)  // Respect .gitignore files (skips node_modules natively)
        .build_parallel();

    let project_path_str = project_path.to_string(); 

    // Execute multi-threaded traversal
    walker.run(|| {
        // --- This block runs ONCE PER THREAD during thread startup ---
        
        let tx = tx.clone();
        let match_count = Arc::clone(&match_count);
        let regex = regex.clone(); 
        let include_regex = include_regex.clone();
        let project_path_str = project_path_str.clone();
        
        // Allocate ONE reusable buffer per thread to eliminate per-line string allocations
        let mut line_buffer = String::new();

        Box::new(move |result| {
            // --- This block runs FOR EVERY FILE encountered by this thread ---
            
            // Fast early exit: if another thread hit the max, stop walking immediately
            if match_count.load(Ordering::Relaxed) >= max_results {
                return WalkState::Quit;
            }

            let entry = match result {
                Ok(e) => e,
                Err(_) => return WalkState::Continue, // Skip unreadable paths safely
            };

            let path = entry.path();
            if !path.is_file() {
                return WalkState::Continue; // Only process actual files
            }

            let name = entry.file_name().to_string_lossy();

            // Check include glob/regex
            if let Some(ref inc) = include_regex {
                if !inc.is_match(&name) {
                    return WalkState::Continue;
                }
            }

            // Read the file efficiently
            if let Ok(file) = File::open(path) {
                let mut reader = BufReader::new(file);
                let rel_path = path.strip_prefix(Path::new(&project_path_str)).unwrap_or(path);
                let mut line_num = 1;

                loop {
                    line_buffer.clear(); // Clear memory but retain allocated capacity
                    match reader.read_line(&mut line_buffer) {
                        Ok(0) => break, // EOF
                        Ok(_) => {
                            if regex.is_match(&line_buffer) {
                                // Increment atomic counter. If we are under max, format and send
                                let current_count = match_count.fetch_add(1, Ordering::Relaxed);
                                if current_count < max_results {
                                    let match_str = format!(
                                        "{}:{}: {}",
                                        rel_path.display(),
                                        line_num,
                                        line_buffer.trim_end() 
                                    );
                                    let _ = tx.send(match_str);
                                } else {
                                    return WalkState::Quit;
                                }
                            }
                        }
                        Err(_) => break, // Gracefully handle non-UTF8/binary read errors
                    }
                    line_num += 1;
                }
            }

            WalkState::Continue
        })
    });

    // Drop the initial sender so the channel knows all worker threads are done
    drop(tx);

    // Collect all matches received from the threads
    let matches: Vec<String> = rx.into_iter().collect();

    if matches.is_empty() {
        return format!("No matches found for pattern \"{}\" in {}", pattern, search_path);
    }

    matches.join("\n")
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