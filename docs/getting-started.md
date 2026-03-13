# Getting Started

## Prerequisites

- **Node.js** >= 18.0
- **Python** >= 3.11
- **Go** >= 1.22
- **Rust** >= 1.75 (with cargo)

## Quick Start

### 1. Install Dependencies

```bash
# From the root directory
npm install
```

### 2. Generate the Target Project

This creates ~10,000 source files with 15 planted bugs:

```bash
npm run generate
```

This takes 1-3 minutes. The output goes to `target-project/generated/`.

Options:
```bash
# Custom seed (default: 42)
SEED=123 npm run generate

# Smaller log file for faster generation
LOG_SIZE_MB=5 npm run generate
```

### 3. Start the Mock API Server

```bash
npm run mock-api
```

The server starts on `http://localhost:8080` with 500ms response delay.

Options:
```bash
# Custom port and delay
PORT=9090 RESPONSE_DELAY_MS=200 npm run mock-api
```

### 4. Run an Individual Agent

In a separate terminal:

```bash
# JavaScript
npm run agent:js

# Python
npm run agent:py

# Go (first build, then run)
cd agents/go && go build -o bin/agent ./cmd/agent && ./bin/agent

# Rust (first build, then run)
cd agents/rust && cargo build --release && ./target/release/agent-rust
```

### 5. Run the Full Benchmark

This builds all agents, starts the mock API, runs each agent, and produces a comparison report:

```bash
npm run benchmark
```

Run specific languages only:
```bash
npm run benchmark -- javascript python
```

## Project Structure

```
AgentVsAgent/
├── agents/
│   ├── spec/              # Shared contract (tools, prompt, interface)
│   ├── javascript/        # TypeScript agent
│   ├── python/            # Python agent
│   ├── go/                # Go agent
│   └── rust/              # Rust agent
├── mock-api/              # Express server replaying golden transcript
├── target-project/
│   ├── generator/         # Generates the test project
│   └── generated/         # The generated project (gitignored)
├── golden-transcript/     # Pre-recorded API response sequence
├── benchmark/             # Runner, scorer, report generator
│   └── results/           # Benchmark results (JSON)
└── docs/                  # Documentation
```

## Understanding the Results

The key metric is **Agent Core Time**:

```
Agent Core Time = Total Time - API Wait Time
```

- **Total Time**: Wall clock from agent start to finish
- **API Wait Time**: Sum of all fixed delays (e.g., 70 API calls × 500ms = 35s)
- **Agent Core Time**: Everything else — JSON parsing, tool execution, orchestration

This isolates the pure language/framework performance, eliminating network variance.

## Customizing the Benchmark

### Change API Response Delay
```bash
RESPONSE_DELAY_MS=100 npm run benchmark
```

### Change Target Project Size
Edit `target-project/generator/src/file-generator.ts` to adjust file counts, then regenerate.

### Add a New Language
See [Adding a Language](./adding-a-language.md).
