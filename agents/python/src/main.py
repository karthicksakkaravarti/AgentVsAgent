"""
Block 5: Orchestration Loop (The Engine / ReAct Loop)

The main agent entry point that ties all 5 building blocks together:
1. Load System Prompt (Block 1)
2. Initialize State (Block 2)
3. Send request -> Parse response (Block 3)
4. Execute tools via Registry (Block 4)
5. Loop until "stop" (Block 5)
"""

from __future__ import annotations
import json
import os
import sys
import time
import urllib.request
from typing import Any

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from prompt import load_system_prompt, get_user_prompt
from state import StateManager
from parser import parse_response, ToolCallResult, FinalAnswerResult, ErrorResult
from registry import execute_tool

# Environment configuration
MOCK_API_URL = os.environ.get("MOCK_API_URL", "http://localhost:8080")
SESSION_ID = os.environ.get("SESSION_ID", f"py-agent-{int(time.time())}")
PROJECT_PATH = os.environ.get(
    "PROJECT_PATH",
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "target-project", "generated"),
)

# Load tools schema
TOOLS_SCHEMA_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "spec", "tools-schema.json"
)
with open(TOOLS_SCHEMA_PATH, "r") as f:
    tools_schema = json.load(f)


def send_chat_completion(
    api_url: str, session_id: str, messages: list[dict], tools: list[dict]
) -> str:
    """Send a chat completion request using native urllib (no dependencies)."""
    url = f"{api_url}/v1/chat/completions"
    payload = json.dumps(
        {"model": "gpt-4", "messages": messages, "tools": tools}
    ).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {session_id}",
            "X-Session-Id": session_id,
        },
    )

    with urllib.request.urlopen(req) as resp:
        return resp.read().decode("utf-8")


def main() -> None:
    agent_start = time.perf_counter()

    print("=== Python Agent Starting ===")
    print(f"  API: {MOCK_API_URL}")
    print(f"  Session: {SESSION_ID}")
    print(f"  Project: {PROJECT_PATH}")
    print()

    # Block 1: Load system prompt
    system_prompt = load_system_prompt(PROJECT_PATH)
    user_prompt = get_user_prompt(PROJECT_PATH)

    # Block 2: Initialize state
    state = StateManager()
    state.initialize(system_prompt, user_prompt)

    # Timing data
    timing: dict[str, Any] = {
        "agent_total_ms": 0,
        "api_calls": 0,
        "tool_executions": {},
    }

    # Block 5: Orchestration loop
    MAX_STEPS = 200
    step_count = 0

    while step_count < MAX_STEPS:
        step_count += 1

        # Send state to API (Reason)
        size_kb = state.get_serialized_size() / 1024
        print(
            f"[Step {step_count}] Sending request to API "
            f"({state.get_message_count()} messages, ~{size_kb:.0f}KB)..."
        )

        response_body = send_chat_completion(
            MOCK_API_URL, SESSION_ID, state.get_messages(), tools_schema["tools"]
        )
        timing["api_calls"] += 1

        # Block 3: Parse response (Interpret)
        result = parse_response(response_body)

        if isinstance(result, ErrorResult):
            print(f"[Step {step_count}] Parse error: {result.message}")
            break

        if isinstance(result, FinalAnswerResult):
            print(f"[Step {step_count}] Final answer received.")
            print()
            print("=== Agent Summary ===")
            print(result.content[:500])
            break

        if isinstance(result, ToolCallResult):
            # Add assistant message to state
            state.add_assistant_message(result.content, result.tool_calls)

            for tool_call in result.tool_calls or []:
                tc_func = tool_call["function"]
                tc_id = tool_call["id"]
                tc_name = tc_func["name"]
                tc_args = tc_func["arguments"]

                print(f"  [Tool] {tc_name}({tc_args[:80]}...)")

                exec_result = execute_tool(tc_id, tc_name, tc_args, PROJECT_PATH)

                # Record timing
                if exec_result.tool_name not in timing["tool_executions"]:
                    timing["tool_executions"][exec_result.tool_name] = {
                        "count": 0,
                        "total_ms": 0,
                        "times_ms": [],
                    }
                tool_timing = timing["tool_executions"][exec_result.tool_name]
                tool_timing["count"] += 1
                tool_timing["total_ms"] += exec_result.execution_time_ms
                tool_timing["times_ms"].append(
                    round(exec_result.execution_time_ms, 2)
                )

                print(
                    f"  [Tool] {exec_result.tool_name} completed in "
                    f"{exec_result.execution_time_ms:.1f}ms "
                    f"({len(exec_result.result)} chars)"
                )

                # Add tool result to state (Observe)
                state.add_tool_result(tc_id, exec_result.result)

    if step_count >= MAX_STEPS:
        print(f"Agent hit maximum step limit ({MAX_STEPS})", file=sys.stderr)

    # Output timing data (last line — consumed by benchmark runner)
    timing["agent_total_ms"] = round((time.perf_counter() - agent_start) * 1000, 2)

    print()
    total_secs = timing["agent_total_ms"] / 1000
    print(
        f"=== Agent completed in {total_secs:.2f}s "
        f"({timing['api_calls']} API calls) ==="
    )
    print(json.dumps(timing))


if __name__ == "__main__":
    main()
