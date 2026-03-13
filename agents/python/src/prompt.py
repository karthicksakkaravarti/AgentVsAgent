"""
Block 1: System Prompt & Persona (The Rules)

Loads the shared system prompt and prepares it with the project path.
Identical logic across all language implementations.
"""

import os

PROMPT_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "spec", "system-prompt.txt")


def load_system_prompt(project_path: str) -> str:
    with open(PROMPT_FILE, "r") as f:
        template = f.read()
    return template.replace("{PROJECT_PATH}", project_path)


def get_user_prompt(project_path: str) -> str:
    return (
        f"The project at {project_path} has several bugs causing production errors. "
        f"Find and fix all of them. Start by examining the error logs in the logs/ directory."
    )
