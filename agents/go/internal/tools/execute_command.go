package tools

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"time"
)

// ExecuteCommand runs a shell command with timeout.
func ExecuteCommand(args map[string]interface{}, projectPath string) (string, error) {
	command, _ := args["command"].(string)
	timeoutMs := 30000.0
	if t, ok := args["timeout"].(float64); ok {
		timeoutMs = t
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutMs)*time.Millisecond)
	defer cancel()

	cmd := exec.CommandContext(ctx, "sh", "-c", command)
	cmd.Dir = projectPath

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = -1
		}
	}

	return fmt.Sprintf("Exit code: %d\nStdout:\n%s\nStderr:\n%s", exitCode, stdout.String(), stderr.String()), nil
}
