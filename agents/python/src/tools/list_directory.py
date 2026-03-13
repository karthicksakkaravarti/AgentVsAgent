"""Tool: list_directory — list directory contents with type and size."""

import os
from typing import Any


def list_directory(args: dict[str, Any], project_path: str) -> str:
    dir_path = args.get("path", ".")
    recursive = args.get("recursive", False)
    max_depth = args.get("maxDepth", 3)

    full_path = os.path.normpath(os.path.join(project_path, dir_path))

    if not os.path.exists(full_path):
        return f"Error: Directory not found: {dir_path}"

    if not os.path.isdir(full_path):
        return f"Error: {dir_path} is not a directory"

    entries: list[str] = []
    _list_dir(full_path, project_path, entries, recursive, max_depth, 0)

    if not entries:
        return f"Directory {dir_path} is empty"

    return "\n".join(entries)


def _list_dir(
    dir_path: str,
    project_root: str,
    entries: list[str],
    recursive: bool,
    max_depth: int,
    current_depth: int,
) -> None:
    indent = "  " * current_depth

    try:
        items = sorted(os.listdir(dir_path))
    except PermissionError:
        return

    for item in items:
        full = os.path.join(dir_path, item)

        if os.path.isdir(full):
            try:
                child_count = len(os.listdir(full))
            except PermissionError:
                child_count = 0
            entries.append(f"{indent}[DIR]  {item}/ ({child_count} items)")

            if recursive and current_depth < max_depth:
                _list_dir(full, project_root, entries, recursive, max_depth, current_depth + 1)
        elif os.path.isfile(full):
            try:
                size = os.path.getsize(full)
                entries.append(f"{indent}[FILE] {item} ({_format_size(size)})")
            except OSError:
                entries.append(f"{indent}[FILE] {item}")


def _format_size(bytes_: int) -> str:
    if bytes_ < 1024:
        return f"{bytes_}B"
    if bytes_ < 1024 * 1024:
        return f"{bytes_ / 1024:.1f}KB"
    return f"{bytes_ / (1024 * 1024):.1f}MB"
