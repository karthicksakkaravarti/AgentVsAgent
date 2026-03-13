// Block 5: Orchestration Loop (The Engine / ReAct Loop) — Go Agent
//
// Entry point that ties all 5 building blocks together.
package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"time"

	"github.com/agent-vs-agent/agent-go/internal/api"
	"github.com/agent-vs-agent/agent-go/internal/router"
	"github.com/agent-vs-agent/agent-go/internal/types"
)

func main() {
	agentStart := time.Now()

	// Environment configuration
	apiURL := getEnv("MOCK_API_URL", "http://localhost:8080")
	sessionID := getEnv("SESSION_ID", fmt.Sprintf("go-agent-%d", time.Now().Unix()))
	projectPath := getEnv("PROJECT_PATH", filepath.Join("..", "..", "target-project", "generated"))

	fmt.Println("=== Go Agent Starting ===")
	fmt.Printf("  API: %s\n", apiURL)
	fmt.Printf("  Session: %s\n", sessionID)
	fmt.Printf("  Project: %s\n", projectPath)
	fmt.Println()

	// Block 1: Load system prompt
	promptPath := filepath.Join("..", "..", "agents", "spec", "system-prompt.txt")
	// Try relative to binary location too
	if _, err := os.Stat(promptPath); os.IsNotExist(err) {
		execPath, _ := os.Executable()
		promptPath = filepath.Join(filepath.Dir(execPath), "..", "..", "..", "agents", "spec", "system-prompt.txt")
	}
	promptData, err := os.ReadFile(promptPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to read system prompt: %v\n", err)
		os.Exit(1)
	}
	systemPrompt := string(promptData)
	// Replace placeholder
	for i := 0; i < 10; i++ {
		systemPrompt = replaceAll(systemPrompt, "{PROJECT_PATH}", projectPath)
	}

	userPrompt := fmt.Sprintf("The project at %s has several bugs causing production errors. Find and fix all of them. Start by examining the error logs in the logs/ directory.", projectPath)

	// Load tools schema
	toolsSchemaPath := filepath.Join("..", "..", "agents", "spec", "tools-schema.json")
	if _, err := os.Stat(toolsSchemaPath); os.IsNotExist(err) {
		execPath, _ := os.Executable()
		toolsSchemaPath = filepath.Join(filepath.Dir(execPath), "..", "..", "..", "agents", "spec", "tools-schema.json")
	}
	toolsData, err := os.ReadFile(toolsSchemaPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to read tools schema: %v\n", err)
		os.Exit(1)
	}
	var toolsSchema struct {
		Tools []interface{} `json:"tools"`
	}
	json.Unmarshal(toolsData, &toolsSchema)

	// Block 2: Initialize state
	content := systemPrompt
	messages := []types.Message{
		{Role: "system", Content: &content},
		{Role: "user", Content: &userPrompt},
	}

	// API client
	client := api.NewClient(apiURL, sessionID)

	// Timing data
	timing := types.TimingData{
		ToolExecutions: make(map[string]*types.ToolTimingDetails),
	}

	// Block 5: Orchestration loop
	maxSteps := 200
	for step := 1; step <= maxSteps; step++ {
		msgSize := estimateSize(messages)
		fmt.Printf("[Step %d] Sending request to API (%d messages, ~%dKB)...\n", step, len(messages), msgSize/1024)

		// Send state to API (Reason)
		respBody, err := client.SendChatCompletion(messages, toolsSchema.Tools)
		if err != nil {
			fmt.Fprintf(os.Stderr, "[Step %d] API error: %v\n", step, err)
			break
		}
		timing.APICalls++

		// Block 3: Parse response (Interpret)
		var resp types.ChatCompletionResponse
		if err := json.Unmarshal(respBody, &resp); err != nil {
			fmt.Fprintf(os.Stderr, "[Step %d] Parse error: %v\n", step, err)
			break
		}

		if len(resp.Choices) == 0 {
			fmt.Fprintf(os.Stderr, "[Step %d] No choices in response\n", step)
			break
		}

		choice := resp.Choices[0]

		if choice.FinishReason == "stop" {
			fmt.Printf("[Step %d] Final answer received.\n", step)
			fmt.Println()
			fmt.Println("=== Agent Summary ===")
			if choice.Message.Content != nil {
				text := *choice.Message.Content
				if len(text) > 500 {
					text = text[:500]
				}
				fmt.Println(text)
			}
			break
		}

		if choice.FinishReason == "tool_calls" {
			// Add assistant message to state
			messages = append(messages, choice.Message)

			// Block 4: Execute tools (Act)
			for _, tc := range choice.Message.ToolCalls {
				argsPreview := tc.Function.Arguments
				if len(argsPreview) > 80 {
					argsPreview = argsPreview[:80]
				}
				fmt.Printf("  [Tool] %s(%s...)\n", tc.Function.Name, argsPreview)

				result := router.ExecuteTool(tc.ID, tc.Function.Name, tc.Function.Arguments, projectPath)

				// Record timing
				td, ok := timing.ToolExecutions[result.ToolName]
				if !ok {
					td = &types.ToolTimingDetails{}
					timing.ToolExecutions[result.ToolName] = td
				}
				td.Count++
				td.TotalMs += result.ExecutionTimeMs
				td.TimesMs = append(td.TimesMs, math.Round(result.ExecutionTimeMs*100)/100)

				fmt.Printf("  [Tool] %s completed in %.1fms (%d chars)\n", result.ToolName, result.ExecutionTimeMs, len(result.Result))

				// Add tool result to state (Observe)
				toolContent := result.Result
				messages = append(messages, types.Message{
					Role:       "tool",
					ToolCallID: tc.ID,
					Content:    &toolContent,
				})
			}
		}
	}

	// Output timing data
	timing.AgentTotalMs = math.Round(time.Since(agentStart).Seconds()*1000*100) / 100

	fmt.Println()
	fmt.Printf("=== Agent completed in %.2fs (%d API calls) ===\n", timing.AgentTotalMs/1000, timing.APICalls)

	timingJSON, _ := json.Marshal(timing)
	fmt.Println(string(timingJSON))
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func replaceAll(s, old, new string) string {
	for {
		i := indexOf(s, old)
		if i < 0 {
			return s
		}
		s = s[:i] + new + s[i+len(old):]
	}
}

func indexOf(s, sub string) int {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func estimateSize(messages []types.Message) int {
	data, _ := json.Marshal(messages)
	return len(data)
}
