"""
Block 2: State & Memory Manager (The Context Window)

Maintains the growing messages list across the conversation loop.
Each iteration serializes this entire list to JSON for the API request.

Benchmarks: list manipulation, JSON serialization, memory reallocation.
"""

from __future__ import annotations
import json
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolCall:
    id: str
    type: str  # always "function"
    function: dict  # {"name": str, "arguments": str}


@dataclass
class Message:
    role: str  # "system" | "user" | "assistant" | "tool"
    content: str | None = None
    tool_calls: list[dict] | None = None
    tool_call_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"role": self.role, "content": self.content}
        if self.tool_calls is not None:
            d["tool_calls"] = self.tool_calls
        if self.tool_call_id is not None:
            d["tool_call_id"] = self.tool_call_id
        return d


class StateManager:
    def __init__(self) -> None:
        self._messages: list[Message] = []

    def initialize(self, system_prompt: str, user_message: str) -> None:
        self._messages = [
            Message(role="system", content=system_prompt),
            Message(role="user", content=user_message),
        ]

    def add_assistant_message(
        self, content: str | None, tool_calls: list[dict] | None = None
    ) -> None:
        self._messages.append(
            Message(role="assistant", content=content, tool_calls=tool_calls)
        )

    def add_tool_result(self, tool_call_id: str, result: str) -> None:
        self._messages.append(
            Message(role="tool", tool_call_id=tool_call_id, content=result)
        )

    def get_messages(self) -> list[dict[str, Any]]:
        return [m.to_dict() for m in self._messages]

    def get_message_count(self) -> int:
        return len(self._messages)

    def get_serialized_size(self) -> int:
        return len(json.dumps(self.get_messages()).encode("utf-8"))
