"""
Block 3: Parser / Output Extractor (The Interpreter)

Parses API responses and determines whether the LLM is requesting
tool execution or providing a final answer.

Benchmarks: JSON deserialization, deeply nested object traversal.
"""

from __future__ import annotations
import json
from dataclasses import dataclass
from typing import Any, Union


@dataclass
class ToolCallResult:
    type: str = "tool_calls"
    tool_calls: list[dict] | None = None
    content: str | None = None


@dataclass
class FinalAnswerResult:
    type: str = "final_answer"
    content: str = ""


@dataclass
class ErrorResult:
    type: str = "error"
    message: str = ""


ParseResult = Union[ToolCallResult, FinalAnswerResult, ErrorResult]


def parse_response(response_body: str) -> ParseResult:
    """Parse the raw API response body into a structured result."""
    try:
        parsed = json.loads(response_body)
    except json.JSONDecodeError as e:
        return ErrorResult(message=f"Failed to parse JSON: {e}")

    choices = parsed.get("choices")
    if not choices:
        return ErrorResult(message="Response has no choices")

    choice = choices[0]
    finish_reason = choice.get("finish_reason")

    if finish_reason == "stop":
        content = choice.get("message", {}).get("content", "")
        return FinalAnswerResult(content=content or "")

    if finish_reason == "tool_calls":
        tool_calls = choice.get("message", {}).get("tool_calls")
        if not tool_calls:
            return ErrorResult(
                message="finish_reason is tool_calls but no tool_calls found"
            )
        content = choice.get("message", {}).get("content")
        return ToolCallResult(tool_calls=tool_calls, content=content)

    return ErrorResult(message=f"Unknown finish_reason: {finish_reason}")


def parse_tool_arguments(args_json: str) -> dict[str, Any]:
    """Parse tool call arguments from JSON string."""
    return json.loads(args_json)
