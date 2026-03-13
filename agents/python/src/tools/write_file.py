"""Tool: write_file — write content to a file, creating dirs if needed."""

import os
from typing import Any


def write_file(args: dict[str, Any], project_path: str) -> str:
    file_path = args["path"]
    content = args["content"]

    full_path = os.path.normpath(os.path.join(project_path, file_path))
    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)

    byte_count = len(content.encode("utf-8"))
    return f"Written {byte_count} bytes to {file_path}"
