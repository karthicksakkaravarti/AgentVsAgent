# Agent vs Agent

A benchmark platform that measures the **raw performance overhead** of agentic AI implementations across programming languages.

By replacing the real LLM API with a mock server that replays a golden transcript with fixed delays, the only variable is the agent's own overhead — JSON parsing, tool execution, file I/O, and orchestration logic.

## How It Works

```
Agent Core Time = Total Time − API Wait Time
```

Every agent runs the exact same task (find & fix bugs in a 10,000-file TypeScript project), makes the same API calls, and executes the same tool sequence. The difference is purely the language's implementation cost.

## Benchmark Results

> Run date: 2026-03-14 · 77 API calls · 43/50 bugs fixed · Response delay: 0ms

### Overall Performance

```
┌─────────────┬────────────┬────────────┬────────────┬──────────┬───────────┐
│ Language    │ Total Time │  API Wait  │ Core Time  │ API Calls│ Bugs Fixed│
├─────────────┼────────────┼────────────┼────────────┼──────────┼───────────┤
│ rust        │      2.05s │      0.00s │      2.05s │       77 │     43/50 │
│ javascript  │      5.45s │      0.00s │      5.45s │       77 │     43/50 │
│ go          │     19.02s │      0.00s │     19.02s │       77 │     43/50 │
│ c           │     20.52s │      0.00s │     20.52s │       77 │     43/50 │
│ python      │     24.76s │      0.00s │     24.76s │       77 │     43/50 │
└─────────────┴────────────┴────────────┴────────────┴──────────┴───────────┘

🏆 FASTEST: Rust (2.05s) — 12.1x faster than Python
```

### Per-Tool Execution Times (avg ms)

```
┌───────────────────┬───────────┬───────────┬───────────┬───────────┬───────────┐
│ Tool              │ rust      │javascript │ go        │ c         │ python    │
├───────────────────┼───────────┼───────────┼───────────┼───────────┼───────────┤
│ analyze_code      │      0.9ms│      0.2ms│      1.0ms│      0.0ms│      2.3ms│
│ read_file         │      0.1ms│      0.3ms│      0.1ms│      0.0ms│      0.3ms│
│ list_directory    │      1.5ms│      1.9ms│      3.0ms│      0.0ms│      1.7ms│
│ search_files      │     85.8ms│    319.4ms│   1215.1ms│   1327.7ms│   1588.0ms│
│ write_file        │      0.1ms│      0.2ms│      0.3ms│      0.4ms│      0.4ms│
└───────────────────┴───────────┴───────────┴───────────┴───────────┴───────────┘
```

### Key Observations

- **Rust** dominates overall at 2.05s, driven by its near-zero overhead on every tool.
- **JavaScript** surprises at 2.7× Rust's time — V8's JIT and native `fs` module are highly optimised.
- **Go and C** are close (19s vs 20.5s). C's `search_files` is the bottleneck at 1327ms avg — POSIX `regex.h` is slower than Go's compiled regex engine.
- **Python** is slowest overall at 24.76s, with `search_files` at 1588ms avg.
- `search_files` dominates total time for every language — it walks ~10,000 files with regex matching and is the main differentiator.

## Supported Languages

| Language | Build | Run |
|----------|-------|-----|
| Rust | `cargo build --release` | `./target/release/agent-rust` |
| JavaScript | `npm run build` | `node dist/index.js` |
| Go | `go build -o bin/agent ./cmd/agent` | `./bin/agent` |
| C | `make` | `./bin/agent` |
| Python | — | `python3 src/main.py` |

## Quick Start

### Prerequisites

- Node.js >= 18, Python >= 3.11, Go >= 1.22, Rust >= 1.75, GCC + libcurl

### Setup

```bash
npm install          # install dependencies
npm run generate     # generate ~10k-file target project + golden transcript
```

### Run the Full Benchmark

```bash
npm run benchmark
```

Run specific languages:

```bash
npm run benchmark -- rust javascript c
```

### Run a Single Agent

```bash
# Start mock API in one terminal
npm run mock-api

# Run agent in another terminal
npm run agent:rust
npm run agent:js
npm run agent:go
npm run agent:c
npm run agent:py
```

## Project Structure

```
AgentVsAgent/
├── agents/
│   ├── spec/              # Shared contract: tools schema + system prompt
│   ├── javascript/        # TypeScript/Node.js agent
│   ├── python/            # Python agent
│   ├── go/                # Go agent
│   ├── rust/              # Rust agent
│   └── c/                 # C agent (libcurl + cJSON)
├── mock-api/              # Express server replaying golden transcript
├── target-project/
│   ├── generator/         # Generates the test project
│   └── generated/         # Generated project (gitignored)
├── golden-transcript/     # Pre-recorded API response sequence
├── benchmark/             # Runner, scorer, report generator
│   └── results/           # Benchmark results (JSON)
└── docs/                  # Documentation
```

## Architecture

Each agent implements 5 identical building blocks using only its standard library:

| Block | Purpose | What's Benchmarked |
|-------|---------|-------------------|
| 1. System Prompt | Load + template prompt | Baseline |
| 2. State Manager | Maintain message history | JSON serialization, array ops |
| 3. Parser | Extract tool calls from API response | JSON deserialization |
| 4. Tool Registry | Map names → handlers, execute | Disk I/O, regex, directory walking |
| 5. Orchestration Loop | ReAct loop, HTTP client | HTTP overhead, loop cost |

See [docs/architecture.md](docs/architecture.md) for details.
See [docs/adding-a-language.md](docs/adding-a-language.md) to add a new language.
