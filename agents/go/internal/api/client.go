// Package api provides the HTTP client for the Mock API server.
package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/agent-vs-agent/agent-go/internal/types"
)

// Client communicates with the Mock LLM API.
type Client struct {
	baseURL    string
	sessionID  string
	httpClient *http.Client
}

// NewClient creates a new API client.
func NewClient(baseURL, sessionID string) *Client {
	return &Client{
		baseURL:    baseURL,
		sessionID:  sessionID,
		httpClient: &http.Client{},
	}
}

// SendChatCompletion sends a chat completion request and returns the raw response body.
func (c *Client) SendChatCompletion(messages []types.Message, tools []interface{}) ([]byte, error) {
	payload := types.ChatCompletionRequest{
		Model:    "gpt-4",
		Messages: messages,
		Tools:    tools,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := c.baseURL + "/v1/chat/completions"
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.sessionID)
	req.Header.Set("X-Session-Id", c.sessionID)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API returned %d: %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}
