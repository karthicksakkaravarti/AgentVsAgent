package tools

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ReadFile reads file contents with optional line range support.
func ReadFile(args map[string]interface{}, projectPath string) (string, error) {
	filePath, _ := args["path"].(string)
	startLine := 0
	endLine := 0
	if sl, ok := args["startLine"].(float64); ok {
		startLine = int(sl)
	}
	if el, ok := args["endLine"].(float64); ok {
		endLine = int(el)
	}

	fullPath := filepath.Join(projectPath, filePath)

	info, err := os.Stat(fullPath)
	if os.IsNotExist(err) {
		return fmt.Sprintf("Error: File not found: %s", filePath), nil
	}
	if err != nil {
		return "", err
	}
	if info.IsDir() {
		return fmt.Sprintf("Error: %s is a directory, not a file", filePath), nil
	}

	// For large files with range, use streaming
	if (startLine > 0 || endLine > 0) && info.Size() > 1024*1024 {
		return readRange(fullPath, startLine, endLine)
	}

	data, err := os.ReadFile(fullPath)
	if err != nil {
		return "", fmt.Errorf("read file: %w", err)
	}

	lines := strings.Split(string(data), "\n")

	if startLine > 0 || endLine > 0 {
		start := startLine
		if start == 0 {
			start = 1
		}
		end := endLine
		if end == 0 {
			end = len(lines)
		}
		start-- // convert to 0-indexed
		if end > len(lines) {
			end = len(lines)
		}

		var result strings.Builder
		for i := start; i < end; i++ {
			if i > start {
				result.WriteString("\n")
			}
			result.WriteString(fmt.Sprintf("%d: %s", i+1, lines[i]))
		}
		return result.String(), nil
	}

	var result strings.Builder
	for i, line := range lines {
		if i > 0 {
			result.WriteString("\n")
		}
		result.WriteString(fmt.Sprintf("%d: %s", i+1, line))
	}
	return result.String(), nil
}

func readRange(fullPath string, startLine, endLine int) (string, error) {
	f, err := os.Open(fullPath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	start := startLine
	if start == 0 {
		start = 1
	}
	end := endLine
	if end == 0 {
		end = 1<<31 - 1
	}

	var result strings.Builder
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		if lineNum >= start && lineNum <= end {
			if lineNum > start {
				result.WriteString("\n")
			}
			result.WriteString(fmt.Sprintf("%d: %s", lineNum, scanner.Text()))
		}
		if lineNum > end {
			break
		}
	}

	return result.String(), nil
}
