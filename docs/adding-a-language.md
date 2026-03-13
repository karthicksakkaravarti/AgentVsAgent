# Adding a New Language Agent

This guide explains how to add a new programming language to the benchmark.

## Overview

Every agent must implement the **5 Building Blocks** using the language's native standard library. No shelling out to external tools for the benchmarked operations.

## Step-by-Step

### 1. Create the Agent Directory

```
agents/<language>/
├── src/
│   ├── main / index          # Block 5: Orchestration Loop
│   ├── prompt                # Block 1: System Prompt loader
│   ├── state                 # Block 2: State Manager
│   ├── parser                # Block 3: Output Extractor
│   ├── registry              # Block 4: Tool Registry
│   └── tools/
│       ├── search_files      # Regex search across filesystem
│       ├── read_file         # File read with line ranges
│       ├── write_file        # Write with auto-mkdir
│       ├── list_directory    # Recursive directory listing
│       ├── execute_command   # Subprocess with timeout
│       └── analyze_code      # Regex-based code analysis
```

### 2. Implement the 5 Blocks

#### Block 1: System Prompt
- Read `agents/spec/system-prompt.txt`
- Replace `{PROJECT_PATH}` with the `PROJECT_PATH` env var

#### Block 2: State Manager
- Maintain a `messages` array/list/vec
- Support: `initialize()`, `addAssistantMessage()`, `addToolResult()`, `getMessages()`
- Serialize to JSON for each API call

#### Block 3: Parser
- Parse JSON response from API
- Check `choices[0].finish_reason`: `"stop"` or `"tool_calls"`
- Extract tool calls: `id`, `function.name`, `function.arguments`

#### Block 4: Tool Registry
- Map of `string → function`
- Parse `function.arguments` (JSON string) into typed args
- Execute and return string result
- Record execution time per tool call

#### Block 5: Orchestration Loop
```
1. Read env vars: MOCK_API_URL, SESSION_ID, PROJECT_PATH
2. Load system prompt, tools schema
3. Initialize state with system + user messages
4. LOOP:
   a. POST to /v1/chat/completions with {model, messages, tools}
   b. Parse response
   c. If "stop" → break
   d. For each tool_call → execute → record timing → add to state
5. Output timing JSON as last stdout line
6. Exit 0
```

### 3. Tool Implementation Requirements

All tools must use **native language APIs only** (no shelling out):

| Tool | Key Operations | What to Use |
|------|---------------|-------------|
| `search_files` | Walk dirs, read files, regex match | `os.walk` / `filepath.Walk` / `walkdir` |
| `read_file` | Read file, optional line range | `fs.readFile` / `os.ReadFile` / `std::fs::read` |
| `write_file` | Create dirs, write file | `fs.writeFile` / `os.WriteFile` / `std::fs::write` |
| `list_directory` | Read dir entries, get size | `fs.readdir` / `os.ReadDir` / `std::fs::read_dir` |
| `execute_command` | Spawn subprocess, timeout | `child_process` / `os/exec` / `std::process` |
| `analyze_code` | Read file, regex extraction | Standard regex library |

### 4. Register in Benchmark Runner

Edit `benchmark/src/runner.ts` and add your language to the `languages` array:

```typescript
{
  name: 'your-language',
  buildCommand: 'your-build-command',  // optional
  runCommand: './your-binary',
  cwd: path.join(ROOT, 'agents', 'your-language'),
}
```

### 5. Add npm Script

In the root `package.json`:

```json
"agent:yourlang": "cd agents/your-language && your-run-command"
```

### 6. Test

```bash
# Start mock API
npm run mock-api

# Run your agent
npm run agent:yourlang

# Verify it completes all steps and outputs timing JSON
```

### 7. Benchmark

```bash
npm run benchmark -- your-language javascript
```

## Environment Variables

Your agent receives:

| Variable | Example |
|----------|---------|
| `MOCK_API_URL` | `http://localhost:8080` |
| `SESSION_ID` | `bench-yourlang-1234567` |
| `PROJECT_PATH` | `/tmp/agent-run-xyz/` |

## Output Format

Last line of stdout must be valid JSON:

```json
{
  "agent_total_ms": 12345.67,
  "api_calls": 42,
  "tool_executions": {
    "search_files": {"count": 10, "total_ms": 4500.0, "times_ms": [450.0, 320.0]},
    "read_file": {"count": 15, "total_ms": 600.0, "times_ms": [40.0, 35.0]}
  }
}
```

## API Request Format

```
POST {MOCK_API_URL}/v1/chat/completions
Authorization: Bearer {SESSION_ID}
X-Session-Id: {SESSION_ID}
Content-Type: application/json

{"model": "gpt-4", "messages": [...], "tools": [...]}
```

## Reference Implementations

Study the existing agents for guidance:
- **JavaScript** (`agents/javascript/`) — most readable, good starting point
- **Python** (`agents/python/`) — clean Python idioms
- **Go** (`agents/go/`) — typed structs, standard library
- **Rust** (`agents/rust/`) — serde + ureq, zero-copy where possible
