"""Tool: execute_command — run shell commands with timeout."""

import subprocess
from typing import Any


def execute_command(args: dict[str, Any], project_path: str) -> str:
    command = args["command"]
    timeout = args.get("timeout", 30000) / 1000  # Convert ms to seconds

    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=project_path,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return (
            f"Exit code: {result.returncode}\n"
            f"Stdout:\n{result.stdout}\n"
            f"Stderr:\n{result.stderr}"
        )
    except subprocess.TimeoutExpired:
        return f"Exit code: -1\nError: Command timed out after {timeout}s"
    except Exception as e:
        return f"Exit code: -1\nError: {e}"
