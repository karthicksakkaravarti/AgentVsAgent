# Agent Interface Specification

## Overview
Every agent implementation must follow this contract to ensure fair benchmarking across languages.

## Environment Variables
The benchmark runner provides these environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `MOCK_API_URL` | Base URL of the mock LLM API | `http://localhost:8080` |
| `SESSION_ID` | Unique session identifier for this run | `session-abc123` |
| `PROJECT_PATH` | Absolute path to the target project | `/tmp/agent-run-xyz/` |

## The 5 Building Blocks

### Block 1: System Prompt (The Rules)
- Load the system prompt from `agents/spec/system-prompt.txt`
- Replace `{PROJECT_PATH}` with the `PROJECT_PATH` environment variable
- This becomes the first message in the messages array

### Block 2: State Manager (The Context Window)
- Maintain a `messages` array following the OpenAI Chat Completions format
- Initial state: `[{role: "system", content: <prompt>}, {role: "user", content: <task>}]`
- After each API response with tool_calls: append the assistant message, then append tool result messages
- The entire messages array is sent with every API request

### Block 3: Parser (The Interpreter)
- Parse the JSON response from the API
- Check `choices[0].finish_reason`:
  - `"tool_calls"` → extract tool calls from `choices[0].message.tool_calls`
  - `"stop"` → the agent is done, extract final text from `choices[0].message.content`
- Each tool call has: `id`, `type: "function"`, `function.name`, `function.arguments` (JSON string)

### Block 4: Tool Registry (The Hands)
- Implement all 6 tools using native language APIs (NO shelling out to grep, find, etc.)
- Map tool names to handler functions
- Parse `function.arguments` JSON string into the tool's parameters
- Return tool results as strings

### Block 5: Orchestration Loop (The Engine)
```
1. Initialize state with system prompt + user message
2. LOOP:
   a. POST /v1/chat/completions with {model, messages, tools}
   b. Parse response
   c. IF finish_reason == "stop" → BREAK
   d. FOR EACH tool_call in response:
      - Execute tool via registry
      - Record execution time
      - Append assistant message + tool result to state
   e. GOTO 2
3. Output timing JSON to stdout (last line)
4. Exit with code 0
```

## API Request Format
```json
POST {MOCK_API_URL}/v1/chat/completions
Authorization: Bearer {SESSION_ID}
Content-Type: application/json

{
  "model": "gpt-4",
  "messages": [...],
  "tools": [<from tools-schema.json>]
}
```

## Tool Result Message Format
```json
{
  "role": "tool",
  "tool_call_id": "<id from the tool_call>",
  "content": "<string result of tool execution>"
}
```

## Output Format
The last line of stdout must be a JSON object with timing data:
```json
{
  "agent_total_ms": 12345,
  "api_calls": 42,
  "tool_executions": {
    "search_files": {"count": 10, "total_ms": 4500, "times_ms": [450, 320, ...]},
    "read_file": {"count": 15, "total_ms": 600, "times_ms": [40, 35, ...]},
    "write_file": {"count": 8, "total_ms": 160, "times_ms": [20, 18, ...]},
    "list_directory": {"count": 3, "total_ms": 1200, "times_ms": [400, 380, ...]},
    "execute_command": {"count": 2, "total_ms": 1000, "times_ms": [500, 500]},
    "analyze_code": {"count": 5, "total_ms": 250, "times_ms": [50, 48, ...]}
  }
}
```

## Exit Codes
- `0` — Success (all tool calls completed, received stop signal)
- `1` — Error (API connection failure, tool execution error, etc.)

## Tool Implementation Requirements

### search_files
- Walk the directory tree using native filesystem APIs
- Match file contents against the regex pattern
- Respect the `include` glob filter
- Return up to `maxResults` matching lines in format: `{file}:{line_number}: {content}`

### read_file
- Read the file at the given path
- If `startLine`/`endLine` provided, return only that range (efficiently, without loading entire file for large files)
- Return the file content as a string with line numbers prefixed

### write_file
- Create parent directories if they don't exist
- Write the content to the file, overwriting if it exists
- Return confirmation string: `"Written {bytes} bytes to {path}"`

### list_directory
- List directory entries with type (file/dir) and size
- If `recursive`, walk up to `maxDepth` levels deep
- Return formatted listing

### execute_command
- Spawn a subprocess with the given command
- Enforce timeout (kill process if exceeded)
- Return: `"Exit code: {code}\nStdout:\n{stdout}\nStderr:\n{stderr}"`

### analyze_code
- Read the file content
- Based on `analysis` type, use regex to extract:
  - `imports`: import/require statements
  - `exports`: export statements
  - `functions`: function declarations with signatures
  - `classes`: class declarations with method names
  - `errors`: try/catch blocks, throw statements, error handling
  - `dependencies`: referenced modules/packages
- Return structured text output
