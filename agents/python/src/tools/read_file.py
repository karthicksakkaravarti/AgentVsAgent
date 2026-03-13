"""Tool: read_file — read file contents with optional line range."""

import os
from typing import Any


def read_file(args: dict[str, Any], project_path: str) -> str:
    file_path = args["path"]
    start_line = args.get("startLine")
    end_line = args.get("endLine")

    full_path = os.path.normpath(os.path.join(project_path, file_path))

    if not os.path.exists(full_path):
        return f"Error: File not found: {file_path}"

    if os.path.isdir(full_path):
        return f"Error: {file_path} is a directory, not a file"

    # For range reads on large files, read line by line
    file_size = os.path.getsize(full_path)
    if (start_line or end_line) and file_size > 1024 * 1024:
        return _read_range(full_path, start_line, end_line)

    with open(full_path, "r", encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    if start_line or end_line:
        start = (start_line or 1) - 1
        end = end_line or len(lines)
        selected = lines[start:end]
        return "\n".join(
            f"{start + i + 1}: {line.rstrip()}" for i, line in enumerate(selected)
        )

    return "\n".join(f"{i + 1}: {line.rstrip()}" for i, line in enumerate(lines))


def _read_range(full_path: str, start_line: int | None, end_line: int | None) -> str:
    start = start_line or 1
    end = end_line or float("inf")
    result: list[str] = []

    with open(full_path, "r", encoding="utf-8", errors="replace") as f:
        for line_num, line in enumerate(f, 1):
            if line_num >= start and line_num <= end:
                result.append(f"{line_num}: {line.rstrip()}")
            if line_num > end:
                break

    return "\n".join(result)
