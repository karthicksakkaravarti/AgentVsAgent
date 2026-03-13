# Tool Specification

All 6 tools are defined in `agents/spec/tools-schema.json` using the OpenAI function calling format.

## Tools Overview

| Tool | Purpose | Heavy I/O? |
|------|---------|-----------|
| `search_files` | Regex search across file contents | Yes — walks 10K files |
| `read_file` | Read file with optional line range | Yes — handles 50MB logs |
| `write_file` | Write file, auto-create dirs | Light |
| `list_directory` | List directory with size info | Medium — deep traversal |
| `execute_command` | Run shell command with timeout | Light |
| `analyze_code` | Regex-based code structure analysis | Medium |

## search_files

**Purpose:** Search file contents matching a regex pattern.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `pattern` | string | Yes | — | Regex pattern to search for |
| `path` | string | No | `"."` | Directory to search in |
| `include` | string | No | — | Glob filter (e.g., `"*.ts"`) |
| `maxResults` | integer | No | 100 | Max matching lines to return |

**Return format:**
```
src/modules/auth/handler-0.ts:47: const total = parseFloat(String(amount)) + tax;
src/modules/billing/calc-3.ts:12: if (isNaN(result)) { log("NaN detected"); }
```

**Implementation requirements:**
- Walk the directory tree using native filesystem APIs
- Do NOT shell out to `grep`, `rg`, or `find`
- Skip `node_modules/` and `.git/` directories
- Handle binary files gracefully (skip on read error)
- Apply glob filter to filenames, not paths

## read_file

**Purpose:** Read file contents, optionally a specific line range.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `path` | string | Yes | — | File path relative to project root |
| `startLine` | integer | No | 1 | Start line (1-indexed, inclusive) |
| `endLine` | integer | No | EOF | End line (1-indexed, inclusive) |

**Return format:**
```
1: import { something } from './utils';
2:
3: export class MyClass {
4:   constructor() {
```

**Implementation requirements:**
- For large files (>1MB) with line ranges, use streaming (don't load entire file into memory)
- Prefix every line with its line number
- Handle encoding errors gracefully

## write_file

**Purpose:** Write content to a file, creating parent directories if needed.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `path` | string | Yes | — | File path relative to project root |
| `content` | string | Yes | — | Full file content to write |

**Return format:**
```
Written 1234 bytes to src/modules/auth/handler-0.ts
```

**Implementation requirements:**
- Create all parent directories recursively
- Overwrite existing file

## list_directory

**Purpose:** List directory contents with type (file/dir) and size.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `path` | string | Yes | — | Directory path |
| `recursive` | boolean | No | false | Whether to recurse |
| `maxDepth` | integer | No | 3 | Max recursion depth |

**Return format:**
```
[DIR]  modules/ (10 items)
  [DIR]  auth/ (500 items)
  [DIR]  billing/ (500 items)
[FILE] package.json (245B)
[FILE] README.md (1.2KB)
```

**Implementation requirements:**
- Indent entries by depth level (2 spaces per level)
- Show `[DIR]` or `[FILE]` prefix
- Show item count for directories, byte size for files
- Format size: B, KB, MB

## execute_command

**Purpose:** Run a shell command in the project directory.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `command` | string | Yes | — | Shell command to execute |
| `timeout` | integer | No | 30000 | Timeout in milliseconds |

**Return format:**
```
Exit code: 0
Stdout:
<stdout content>
Stderr:
<stderr content>
```

**Implementation requirements:**
- Execute via `sh -c <command>`
- Set working directory to PROJECT_PATH
- Enforce timeout (kill process if exceeded)
- Capture both stdout and stderr

## analyze_code

**Purpose:** Extract code structure using regex patterns.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `path` | string | Yes | — | File path to analyze |
| `analysis` | enum | Yes | — | One of: `imports`, `exports`, `functions`, `classes`, `errors`, `dependencies` |

**Return format (varies by analysis type):**

```
=== Import Analysis: src/auth/handler.ts ===
  default: Express from "express"
  named: { Router, Request } from "express"
  require: fs from "fs"
```

**Implementation requirements:**
- Use regex patterns, NOT language-specific AST parsers
- This ensures fair benchmarking across all languages
- Support both ES6 imports and CommonJS require
- Support both TypeScript and Python syntax for broader applicability

### Analysis Types

| Type | What to Extract |
|------|----------------|
| `imports` | import/require statements with sources |
| `exports` | named exports, default exports, re-exports |
| `functions` | function declarations with params and return types |
| `classes` | class declarations, extends, method names |
| `errors` | try-catch count, throw statements, .catch() calls |
| `dependencies` | local vs external module references |
