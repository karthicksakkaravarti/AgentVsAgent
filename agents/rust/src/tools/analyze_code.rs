use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

pub fn analyze_code(args: &HashMap<String, serde_json::Value>, project_path: &str) -> String {
    let file_path = args.get("path").and_then(|v| v.as_str()).unwrap_or("");
    let analysis = args.get("analysis").and_then(|v| v.as_str()).unwrap_or("");

    let full_path = Path::new(project_path).join(file_path);

    let content = match fs::read_to_string(&full_path) {
        Ok(c) => c,
        Err(_) => return format!("Error: File not found: {}", file_path),
    };

    match analysis {
        "imports" => analyze_imports(&content, file_path),
        "exports" => analyze_exports(&content, file_path),
        "functions" => analyze_functions(&content, file_path),
        "classes" => analyze_classes(&content, file_path),
        "errors" => analyze_errors(&content, file_path),
        "dependencies" => analyze_dependencies(&content, file_path),
        _ => format!("Error: Unknown analysis type \"{}\"", analysis),
    }
}

fn analyze_imports(content: &str, file_path: &str) -> String {
    let mut results = vec![format!("=== Import Analysis: {} ===", file_path)];

    let re = Regex::new(r#"import\s+(?:\{([^}]+)\}\s+from\s+)?(?:(\w+)\s+from\s+)?['"]([^'"]+)['"]"#).unwrap();
    for cap in re.captures_iter(content) {
        let source = cap.get(3).map(|m| m.as_str()).unwrap_or("");
        if let Some(def) = cap.get(2) {
            results.push(format!("  default: {} from \"{}\"", def.as_str(), source));
        }
        if let Some(named) = cap.get(1) {
            results.push(format!("  named: {{ {} }} from \"{}\"", named.as_str().trim(), source));
        }
    }

    if results.len() == 1 {
        results.push("  No imports found".to_string());
    }
    results.join("\n")
}

fn analyze_exports(content: &str, file_path: &str) -> String {
    let mut results = vec![format!("=== Export Analysis: {} ===", file_path)];

    let re = Regex::new(r"export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)").unwrap();
    for cap in re.captures_iter(content) {
        results.push(format!("  named: {}", &cap[1]));
    }

    let def_re = Regex::new(r"export\s+default\s+(?:class|function)?\s*(\w+)?").unwrap();
    for cap in def_re.captures_iter(content) {
        let name = cap.get(1).map(|m| m.as_str()).unwrap_or("(anonymous)");
        results.push(format!("  default: {}", name));
    }

    if results.len() == 1 {
        results.push("  No exports found".to_string());
    }
    results.join("\n")
}

fn analyze_functions(content: &str, file_path: &str) -> String {
    let mut results = vec![format!("=== Function Analysis: {} ===", file_path)];

    let re = Regex::new(r"(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\S+))?").unwrap();
    for cap in re.captures_iter(content) {
        let name = &cap[1];
        let params = cap.get(2).map(|m| m.as_str().trim()).unwrap_or("none");
        let params = if params.is_empty() { "none" } else { params };
        let ret = cap.get(3).map(|m| m.as_str()).unwrap_or("untyped");
        results.push(format!("  function {}({}): {}", name, params, ret));
    }

    if results.len() == 1 {
        results.push("  No functions found".to_string());
    }
    results.join("\n")
}

fn analyze_classes(content: &str, file_path: &str) -> String {
    let mut results = vec![format!("=== Class Analysis: {} ===", file_path)];

    let re = Regex::new(r"(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?").unwrap();
    for cap in re.captures_iter(content) {
        let mut line = format!("  class {}", &cap[1]);
        if let Some(extends) = cap.get(2) {
            line.push_str(&format!(" extends {}", extends.as_str()));
        }
        results.push(line);
    }

    if results.len() == 1 {
        results.push("  No classes found".to_string());
    }
    results.join("\n")
}

fn analyze_errors(content: &str, file_path: &str) -> String {
    let mut results = vec![format!("=== Error Handling Analysis: {} ===", file_path)];

    let try_re = Regex::new(r"try\s*\{").unwrap();
    results.push(format!("  try-catch blocks: {}", try_re.find_iter(content).count()));

    let throw_re = Regex::new(r"throw\s+new\s+(\w+)").unwrap();
    let throws: Vec<&str> = throw_re.captures_iter(content).map(|c| c.get(1).unwrap().as_str()).collect();
    results.push(format!("  throw statements: {}", throws.len()));
    if !throws.is_empty() {
        let types: HashSet<&str> = throws.into_iter().collect();
        let type_list: Vec<&str> = types.into_iter().collect();
        results.push(format!("  thrown types: {}", type_list.join(", ")));
    }

    let catch_re = Regex::new(r"\.catch\s*\(").unwrap();
    results.push(format!("  .catch() calls: {}", catch_re.find_iter(content).count()));

    results.join("\n")
}

fn analyze_dependencies(content: &str, file_path: &str) -> String {
    let mut results = vec![format!("=== Dependency Analysis: {} ===", file_path)];
    let mut deps = HashSet::new();

    let from_re = Regex::new(r#"from\s+['"]([^'"]+)['"]"#).unwrap();
    for cap in from_re.captures_iter(content) {
        deps.insert(cap[1].to_string());
    }

    let req_re = Regex::new(r#"require\(['"]([^'"]+)['"]\)"#).unwrap();
    for cap in req_re.captures_iter(content) {
        deps.insert(cap[1].to_string());
    }

    let mut local: Vec<&str> = deps.iter().filter(|d| d.starts_with('.') || d.starts_with('/')).map(|s| s.as_str()).collect();
    let mut external: Vec<&str> = deps.iter().filter(|d| !d.starts_with('.') && !d.starts_with('/')).map(|s| s.as_str()).collect();
    local.sort();
    external.sort();

    results.push(format!("  Local dependencies ({}):", local.len()));
    for d in &local {
        results.push(format!("    - {}", d));
    }
    results.push(format!("  External dependencies ({}):", external.len()));
    for d in &external {
        results.push(format!("    - {}", d));
    }

    results.join("\n")
}
