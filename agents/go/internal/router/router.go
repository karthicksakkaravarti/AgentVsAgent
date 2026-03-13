// Package router implements Block 4: Tool Registry for the Go agent.
package router

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/agent-vs-agent/agent-go/internal/tools"
	"github.com/agent-vs-agent/agent-go/internal/types"
)

// ToolHandler is a function that executes a tool.
type ToolHandler func(args map[string]interface{}, projectPath string) (string, error)

var registry = map[string]ToolHandler{
	"search_files":    tools.SearchFiles,
	"read_file":       tools.ReadFile,
	"write_file":      tools.WriteFile,
	"list_directory":  tools.ListDirectory,
	"execute_command": tools.ExecuteCommand,
	"analyze_code":    tools.AnalyzeCode,
}

// ExecuteTool dispatches a tool call to its handler.
func ExecuteTool(toolCallID, toolName, argsJSON, projectPath string) types.ToolExecutionResult {
	handler, ok := registry[toolName]
	if !ok {
		available := make([]string, 0, len(registry))
		for k := range registry {
			available = append(available, k)
		}
		return types.ToolExecutionResult{
			ToolCallID:      toolCallID,
			ToolName:        toolName,
			Result:          fmt.Sprintf("Error: Unknown tool %q. Available: %s", toolName, strings.Join(available, ", ")),
			ExecutionTimeMs: 0,
		}
	}

	var args map[string]interface{}
	if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
		return types.ToolExecutionResult{
			ToolCallID:      toolCallID,
			ToolName:        toolName,
			Result:          fmt.Sprintf("Error: Failed to parse arguments: %v", err),
			ExecutionTimeMs: 0,
		}
	}

	start := time.Now()
	result, err := handler(args, projectPath)
	elapsed := time.Since(start).Seconds() * 1000

	if err != nil {
		return types.ToolExecutionResult{
			ToolCallID:      toolCallID,
			ToolName:        toolName,
			Result:          fmt.Sprintf("Error executing %s: %v", toolName, err),
			ExecutionTimeMs: elapsed,
		}
	}

	return types.ToolExecutionResult{
		ToolCallID:      toolCallID,
		ToolName:        toolName,
		Result:          result,
		ExecutionTimeMs: elapsed,
	}
}
