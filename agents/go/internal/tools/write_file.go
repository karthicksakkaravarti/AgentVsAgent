package tools

import (
	"fmt"
	"os"
	"path/filepath"
)

// WriteFile writes content to a file, creating parent directories if needed.
func WriteFile(args map[string]interface{}, projectPath string) (string, error) {
	filePath, _ := args["path"].(string)
	content, _ := args["content"].(string)

	fullPath := filepath.Join(projectPath, filePath)

	if err := os.MkdirAll(filepath.Dir(fullPath), 0o755); err != nil {
		return "", fmt.Errorf("create directories: %w", err)
	}

	if err := os.WriteFile(fullPath, []byte(content), 0o644); err != nil {
		return "", fmt.Errorf("write file: %w", err)
	}

	return fmt.Sprintf("Written %d bytes to %s", len(content), filePath), nil
}
