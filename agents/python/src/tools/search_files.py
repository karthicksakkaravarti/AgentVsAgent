"""Tool: search_files — regex search across filesystem using native Python."""

import os
import re
import fnmatch
from typing import Any


def search_files(args: dict[str, Any], project_path: str) -> str:
    pattern = args["pattern"]
    search_path = args.get("path", ".")
    include = args.get("include")
    max_results = args.get("maxResults", 100)

    regex = re.compile(pattern)
    full_path = os.path.normpath(os.path.join(project_path, search_path))
    matches: list[str] = []

    for root, dirs, files in os.walk(full_path):
        # Skip hidden/vendor directories
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "__pycache__")]

        for filename in files:
            if len(matches) >= max_results:
                break

            if include and not fnmatch.fnmatch(filename, include):
                continue

            filepath = os.path.join(root, filename)
            rel_path = os.path.relpath(filepath, project_path)

            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    for line_num, line in enumerate(f, 1):
                        if len(matches) >= max_results:
                            break
                        if regex.search(line):
                            matches.append(f"{rel_path}:{line_num}: {line.strip()}")
            except (OSError, UnicodeDecodeError):
                continue

        if len(matches) >= max_results:
            break

    if not matches:
        return f'No matches found for pattern "{pattern}" in {search_path}'

    return "\n".join(matches)
