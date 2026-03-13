# Architecture

## Goal

Benchmark the raw agentic framework performance of different programming languages by isolating language overhead from LLM inference time.

## Key Insight

By replacing a real LLM API with a **Mock API** that returns pre-recorded responses with a fixed delay (e.g., 500ms), the only performance variable is the agent's own speed: JSON parsing, tool execution, state management, and HTTP client overhead.

```
Agent Core Time = Total Time - API Wait Time
```

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Benchmark Runner                       │
│  1. Generate target project (10K files, 50MB logs)       │
│  2. Start Mock API server                                │
│  3. For each language:                                   │
│     a. Copy project to temp dir (isolation)              │
│     b. Spawn agent process                               │
│     c. Collect timing metrics                            │
│     d. Score correctness against manifest                │
│  4. Generate comparison report                           │
└──────────────┬───────────────────────────┬───────────────┘
               │                           │
    ┌──────────▼──────────┐     ┌──────────▼──────────┐
    │    Mock API Server   │     │   Target Project     │
    │  (Node.js/Express)   │     │   (10K files)        │
    │                      │     │                      │
    │  POST /v1/chat/      │     │  src/modules/        │
    │    completions       │     │  src/utils/           │
    │                      │     │  logs/application.log │
    │  Returns golden      │     │  config/              │
    │  transcript steps    │     │                      │
    │  with fixed delay    │     │  15 planted bugs     │
    └──────────▲──────────┘     └──────────▲──────────┘
               │                           │
    ┌──────────┴───────────────────────────┴──────────┐
    │              Agent (any language)                 │
    │                                                  │
    │  Block 1: System Prompt  ─── Loads shared prompt │
    │  Block 2: State Manager  ─── Messages array      │
    │  Block 3: Parser         ─── JSON → tool_calls   │
    │  Block 4: Tool Registry  ─── 6 native tools      │
    │  Block 5: Orchestration  ─── ReAct loop          │
    └──────────────────────────────────────────────────┘
```

## The 5 Building Blocks

Every agent implements these 5 components. This is what gets benchmarked:

| Block | Name | Benchmarks |
|-------|------|-----------|
| 1 | System Prompt | Baseline (identical across languages) |
| 2 | State Manager | JSON serialization, array reallocation |
| 3 | Parser | JSON deserialization, nested traversal |
| 4 | Tool Registry | Disk I/O, regex, directory walking |
| 5 | Orchestration | HTTP client, loop overhead |

## Data Flow (One Iteration)

```
Agent                         Mock API              Target Project
  │                              │                       │
  ├─ Serialize messages to JSON  │                       │
  ├─ POST /v1/chat/completions ─►│                       │
  │                              ├─ Look up session step │
  │                              ├─ Sleep(500ms)         │
  │◄─ Return transcript step ────┤                       │
  │                              │                       │
  ├─ Parse JSON response         │                       │
  ├─ Extract tool_calls          │                       │
  ├─ Execute search_files ───────┼──────────────────────►│
  │◄─ Results ───────────────────┼───────────────────────┤
  ├─ Append to state             │                       │
  └─ Loop                        │                       │
```

## Mock API Design

- Mimics OpenAI `/v1/chat/completions` endpoint
- Stateful: per-session step counter (via `X-Session-Id` header)
- Fixed delay per response (configurable, default 500ms)
- Returns pre-recorded responses from `golden-transcript/transcript.json`
- Logs all request/response timestamps for metric calculation

## Target Project Design

- ~10,000 TypeScript source files across 10 modules
- ~50MB application.log with error patterns
- Deeply nested JSON config files
- 15 intentional bugs across 5 categories
- Deterministic generation (fixed PRNG seed = 42)

## Scoring

The scorer validates each bug fix by checking:
1. The buggy code is no longer present in the file
2. The fixed code IS present (or an alternative fix was applied)

## Why This Approach Works

1. **Deterministic**: Same transcript, same project, same bugs every run
2. **Fair**: All agents solve the same problem with the same API responses
3. **Isolated**: `Agent Core Time` removes all API variance
4. **Realistic**: Tools perform real disk I/O on a large codebase
5. **Extensible**: Adding a new language only requires implementing 5 blocks + 6 tools
