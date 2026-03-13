"""
Block 4: Tool Registry (The Hands)

Maps tool names to handler functions and dispatches tool calls.

Benchmarks: heavy disk I/O, regex matching, directory traversal.
"""

from __future__ import annotations
import json
import time
from dataclasses import dataclass
from typing import Any, Callable

from tools import (
    search_files,
    read_file,
    write_file,
    list_directory,
    execute_command,
    analyze_code,
)

ToolHandler = Callable[[dict[str, Any], str], str]

TOOL_REGISTRY: dict[str, ToolHandler] = {
    "search_files": search_files,
    "read_file": read_file,
    "write_file": write_file,
    "list_directory": list_directory,
    "execute_command": execute_command,
    "analyze_code": analyze_code,
}


@dataclass
class ToolExecutionResult:
    tool_call_id: str
    tool_name: str
    result: str
    execution_time_ms: float


def execute_tool(
    tool_call_id: str,
    tool_name: str,
    args_json: str,
    project_path: str,
) -> ToolExecutionResult:
    """Execute a tool call by looking up the handler in the registry."""
    handler = TOOL_REGISTRY.get(tool_name)
    if not handler:
        available = ", ".join(TOOL_REGISTRY.keys())
        return ToolExecutionResult(
            tool_call_id=tool_call_id,
            tool_name=tool_name,
            result=f'Error: Unknown tool "{tool_name}". Available: {available}',
            execution_time_ms=0,
        )

    args = json.loads(args_json)
    start = time.perf_counter()

    try:
        result = handler(args, project_path)
        elapsed_ms = (time.perf_counter() - start) * 1000
        return ToolExecutionResult(
            tool_call_id=tool_call_id,
            tool_name=tool_name,
            result=result,
            execution_time_ms=elapsed_ms,
        )
    except Exception as e:
        elapsed_ms = (time.perf_counter() - start) * 1000
        return ToolExecutionResult(
            tool_call_id=tool_call_id,
            tool_name=tool_name,
            result=f"Error executing {tool_name}: {e}",
            execution_time_ms=elapsed_ms,
        )


def get_tool_names() -> list[str]:
    return list(TOOL_REGISTRY.keys())
