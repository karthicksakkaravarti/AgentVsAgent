// Package types defines shared types for the Go agent.
// These map to the OpenAI-compatible API format.
package types

// Message represents a chat message in the conversation.
type Message struct {
	Role       string     `json:"role"`
	Content    *string    `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
}

// ToolCall represents a tool invocation requested by the LLM.
type ToolCall struct {
	ID       string       `json:"id"`
	Type     string       `json:"type"`
	Function FunctionCall `json:"function"`
}

// FunctionCall contains the function name and arguments.
type FunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

// ChatCompletionRequest is the request body for /v1/chat/completions.
type ChatCompletionRequest struct {
	Model    string        `json:"model"`
	Messages []Message     `json:"messages"`
	Tools    []interface{} `json:"tools"`
}

// ChatCompletionResponse is the response from /v1/chat/completions.
type ChatCompletionResponse struct {
	ID      string   `json:"id"`
	Object  string   `json:"object"`
	Created int64    `json:"created"`
	Model   string   `json:"model"`
	Choices []Choice `json:"choices"`
	Usage   *Usage   `json:"usage,omitempty"`
}

// Choice represents a single completion choice.
type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

// Usage contains token usage information.
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// ToolExecutionResult holds the result of executing a tool.
type ToolExecutionResult struct {
	ToolCallID      string
	ToolName        string
	Result          string
	ExecutionTimeMs float64
}

// TimingData is output as the last line of stdout.
type TimingData struct {
	AgentTotalMs   float64                       `json:"agent_total_ms"`
	APICalls       int                           `json:"api_calls"`
	ToolExecutions map[string]*ToolTimingDetails  `json:"tool_executions"`
}

// ToolTimingDetails tracks per-tool timing.
type ToolTimingDetails struct {
	Count   int       `json:"count"`
	TotalMs float64   `json:"total_ms"`
	TimesMs []float64 `json:"times_ms"`
}
