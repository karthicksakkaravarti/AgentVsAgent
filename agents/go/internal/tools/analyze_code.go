package tools

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// AnalyzeCode performs regex-based code structure analysis.
func AnalyzeCode(args map[string]interface{}, projectPath string) (string, error) {
	filePath, _ := args["path"].(string)
	analysis, _ := args["analysis"].(string)

	fullPath := filepath.Join(projectPath, filePath)

	data, err := os.ReadFile(fullPath)
	if os.IsNotExist(err) {
		return fmt.Sprintf("Error: File not found: %s", filePath), nil
	}
	if err != nil {
		return "", err
	}

	content := string(data)

	switch analysis {
	case "imports":
		return analyzeImports(content, filePath), nil
	case "exports":
		return analyzeExports(content, filePath), nil
	case "functions":
		return analyzeFunctions(content, filePath), nil
	case "classes":
		return analyzeClasses(content, filePath), nil
	case "errors":
		return analyzeErrors(content, filePath), nil
	case "dependencies":
		return analyzeDependencies(content, filePath), nil
	default:
		return fmt.Sprintf("Error: Unknown analysis type %q", analysis), nil
	}
}

func analyzeImports(content, filePath string) string {
	var results []string
	results = append(results, fmt.Sprintf("=== Import Analysis: %s ===", filePath))

	re := regexp.MustCompile(`import\s+(?:\{([^}]+)\}\s+from\s+)?(?:(\w+)\s+from\s+)?['"]([^'"]+)['"]`)
	for _, m := range re.FindAllStringSubmatch(content, -1) {
		named, def, source := m[1], m[2], m[3]
		if def != "" {
			results = append(results, fmt.Sprintf("  default: %s from %q", def, source))
		}
		if named != "" {
			results = append(results, fmt.Sprintf("  named: { %s } from %q", strings.TrimSpace(named), source))
		}
	}

	if len(results) == 1 {
		results = append(results, "  No imports found")
	}
	return strings.Join(results, "\n")
}

func analyzeExports(content, filePath string) string {
	var results []string
	results = append(results, fmt.Sprintf("=== Export Analysis: %s ===", filePath))

	re := regexp.MustCompile(`export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)`)
	for _, m := range re.FindAllStringSubmatch(content, -1) {
		results = append(results, fmt.Sprintf("  named: %s", m[1]))
	}

	defRe := regexp.MustCompile(`export\s+default\s+(?:class|function)?\s*(\w+)?`)
	for _, m := range defRe.FindAllStringSubmatch(content, -1) {
		name := m[1]
		if name == "" {
			name = "(anonymous)"
		}
		results = append(results, fmt.Sprintf("  default: %s", name))
	}

	if len(results) == 1 {
		results = append(results, "  No exports found")
	}
	return strings.Join(results, "\n")
}

func analyzeFunctions(content, filePath string) string {
	var results []string
	results = append(results, fmt.Sprintf("=== Function Analysis: %s ===", filePath))

	re := regexp.MustCompile(`(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\S+))?`)
	for _, m := range re.FindAllStringSubmatch(content, -1) {
		params := strings.TrimSpace(m[2])
		if params == "" {
			params = "none"
		}
		ret := m[3]
		if ret == "" {
			ret = "untyped"
		}
		results = append(results, fmt.Sprintf("  function %s(%s): %s", m[1], params, ret))
	}

	if len(results) == 1 {
		results = append(results, "  No functions found")
	}
	return strings.Join(results, "\n")
}

func analyzeClasses(content, filePath string) string {
	var results []string
	results = append(results, fmt.Sprintf("=== Class Analysis: %s ===", filePath))

	re := regexp.MustCompile(`(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?`)
	for _, m := range re.FindAllStringSubmatch(content, -1) {
		line := fmt.Sprintf("  class %s", m[1])
		if m[2] != "" {
			line += fmt.Sprintf(" extends %s", m[2])
		}
		results = append(results, line)
	}

	if len(results) == 1 {
		results = append(results, "  No classes found")
	}
	return strings.Join(results, "\n")
}

func analyzeErrors(content, filePath string) string {
	var results []string
	results = append(results, fmt.Sprintf("=== Error Handling Analysis: %s ===", filePath))

	tryRe := regexp.MustCompile(`try\s*\{`)
	results = append(results, fmt.Sprintf("  try-catch blocks: %d", len(tryRe.FindAllString(content, -1))))

	throwRe := regexp.MustCompile(`throw\s+new\s+(\w+)`)
	throws := throwRe.FindAllStringSubmatch(content, -1)
	results = append(results, fmt.Sprintf("  throw statements: %d", len(throws)))

	if len(throws) > 0 {
		types := make(map[string]bool)
		for _, t := range throws {
			types[t[1]] = true
		}
		var typeList []string
		for t := range types {
			typeList = append(typeList, t)
		}
		results = append(results, fmt.Sprintf("  thrown types: %s", strings.Join(typeList, ", ")))
	}

	catchRe := regexp.MustCompile(`\.catch\s*\(`)
	results = append(results, fmt.Sprintf("  .catch() calls: %d", len(catchRe.FindAllString(content, -1))))

	return strings.Join(results, "\n")
}

func analyzeDependencies(content, filePath string) string {
	var results []string
	results = append(results, fmt.Sprintf("=== Dependency Analysis: %s ===", filePath))

	deps := make(map[string]bool)

	fromRe := regexp.MustCompile(`from\s+['"]([^'"]+)['"]`)
	for _, m := range fromRe.FindAllStringSubmatch(content, -1) {
		deps[m[1]] = true
	}

	reqRe := regexp.MustCompile(`require\(['"]([^'"]+)['"]\)`)
	for _, m := range reqRe.FindAllStringSubmatch(content, -1) {
		deps[m[1]] = true
	}

	var local, external []string
	for d := range deps {
		if strings.HasPrefix(d, ".") || strings.HasPrefix(d, "/") {
			local = append(local, d)
		} else {
			external = append(external, d)
		}
	}

	results = append(results, fmt.Sprintf("  Local dependencies (%d):", len(local)))
	for _, d := range local {
		results = append(results, fmt.Sprintf("    - %s", d))
	}
	results = append(results, fmt.Sprintf("  External dependencies (%d):", len(external)))
	for _, d := range external {
		results = append(results, fmt.Sprintf("    - %s", d))
	}

	return strings.Join(results, "\n")
}
