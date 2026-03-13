package tools

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// SearchFiles searches file contents using regex patterns.
func SearchFiles(args map[string]interface{}, projectPath string) (string, error) {
	pattern, _ := args["pattern"].(string)
	searchPath, _ := args["path"].(string)
	if searchPath == "" {
		searchPath = "."
	}
	include, _ := args["include"].(string)
	maxResults := 100
	if mr, ok := args["maxResults"].(float64); ok {
		maxResults = int(mr)
	}

	regex, err := regexp.Compile(pattern)
	if err != nil {
		return "", fmt.Errorf("invalid regex pattern: %w", err)
	}

	fullPath := filepath.Join(projectPath, searchPath)
	var matches []string

	var includeRegex *regexp.Regexp
	if include != "" {
		globPattern := globToRegex(include)
		includeRegex, _ = regexp.Compile(globPattern)
	}

	err = filepath.Walk(fullPath, func(path string, info os.FileInfo, err error) error {
		if err != nil || len(matches) >= maxResults {
			return err
		}

		if info.IsDir() {
			name := info.Name()
			if name == "node_modules" || name == ".git" {
				return filepath.SkipDir
			}
			return nil
		}

		if includeRegex != nil && !includeRegex.MatchString(info.Name()) {
			return nil
		}

		f, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer f.Close()

		relPath, _ := filepath.Rel(projectPath, path)
		scanner := bufio.NewScanner(f)
		lineNum := 0

		for scanner.Scan() {
			lineNum++
			if len(matches) >= maxResults {
				break
			}
			line := scanner.Text()
			if regex.MatchString(line) {
				matches = append(matches, fmt.Sprintf("%s:%d: %s", relPath, lineNum, strings.TrimSpace(line)))
			}
		}

		return nil
	})

	if err != nil {
		return "", err
	}

	if len(matches) == 0 {
		return fmt.Sprintf("No matches found for pattern %q in %s", pattern, searchPath), nil
	}

	return strings.Join(matches, "\n"), nil
}

func globToRegex(glob string) string {
	var result strings.Builder
	result.WriteString("^")
	for _, c := range glob {
		switch c {
		case '*':
			result.WriteString(".*")
		case '?':
			result.WriteString(".")
		case '.', '+', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\':
			result.WriteRune('\\')
			result.WriteRune(c)
		default:
			result.WriteRune(c)
		}
	}
	result.WriteString("$")
	return result.String()
}
