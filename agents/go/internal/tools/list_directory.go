package tools

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ListDirectory lists directory contents with type and size info.
func ListDirectory(args map[string]interface{}, projectPath string) (string, error) {
	dirPath, _ := args["path"].(string)
	if dirPath == "" {
		dirPath = "."
	}
	recursive := false
	if r, ok := args["recursive"].(bool); ok {
		recursive = r
	}
	maxDepth := 3
	if md, ok := args["maxDepth"].(float64); ok {
		maxDepth = int(md)
	}

	fullPath := filepath.Join(projectPath, dirPath)

	info, err := os.Stat(fullPath)
	if os.IsNotExist(err) {
		return fmt.Sprintf("Error: Directory not found: %s", dirPath), nil
	}
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return fmt.Sprintf("Error: %s is not a directory", dirPath), nil
	}

	var entries []string
	listDir(fullPath, &entries, recursive, maxDepth, 0)

	if len(entries) == 0 {
		return fmt.Sprintf("Directory %s is empty", dirPath), nil
	}

	return strings.Join(entries, "\n"), nil
}

func listDir(dir string, entries *[]string, recursive bool, maxDepth, currentDepth int) {
	dirEntries, err := os.ReadDir(dir)
	if err != nil {
		return
	}

	indent := strings.Repeat("  ", currentDepth)

	for _, entry := range dirEntries {
		fullPath := filepath.Join(dir, entry.Name())

		if entry.IsDir() {
			childEntries, _ := os.ReadDir(fullPath)
			*entries = append(*entries, fmt.Sprintf("%s[DIR]  %s/ (%d items)", indent, entry.Name(), len(childEntries)))

			if recursive && currentDepth < maxDepth {
				listDir(fullPath, entries, recursive, maxDepth, currentDepth+1)
			}
		} else {
			info, err := entry.Info()
			if err == nil {
				*entries = append(*entries, fmt.Sprintf("%s[FILE] %s (%s)", indent, entry.Name(), formatSize(info.Size())))
			} else {
				*entries = append(*entries, fmt.Sprintf("%s[FILE] %s", indent, entry.Name()))
			}
		}
	}
}

func formatSize(bytes int64) string {
	if bytes < 1024 {
		return fmt.Sprintf("%dB", bytes)
	}
	if bytes < 1024*1024 {
		return fmt.Sprintf("%.1fKB", float64(bytes)/1024)
	}
	return fmt.Sprintf("%.1fMB", float64(bytes)/(1024*1024))
}
