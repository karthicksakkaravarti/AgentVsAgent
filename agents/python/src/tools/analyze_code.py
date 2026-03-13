"""Tool: analyze_code — regex-based code structure analysis."""

import os
import re
from typing import Any


def analyze_code(args: dict[str, Any], project_path: str) -> str:
    file_path = args["path"]
    analysis = args["analysis"]

    full_path = os.path.normpath(os.path.join(project_path, file_path))

    if not os.path.exists(full_path):
        return f"Error: File not found: {file_path}"

    with open(full_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    analyzers = {
        "imports": _analyze_imports,
        "exports": _analyze_exports,
        "functions": _analyze_functions,
        "classes": _analyze_classes,
        "errors": _analyze_errors,
        "dependencies": _analyze_dependencies,
    }

    analyzer = analyzers.get(analysis)
    if not analyzer:
        return f'Error: Unknown analysis type "{analysis}"'

    return analyzer(content, file_path)


def _analyze_imports(content: str, file_path: str) -> str:
    results = [f"=== Import Analysis: {file_path} ==="]

    # ES6 imports
    for m in re.finditer(
        r"import\s+(?:\{([^}]+)\}\s+from\s+)?(?:(\w+)\s+from\s+)?['\"]([^'\"]+)['\"]",
        content,
    ):
        named, default, source = m.group(1), m.group(2), m.group(3)
        if default:
            results.append(f'  default: {default} from "{source}"')
        if named:
            results.append(f'  named: {{ {named.strip()} }} from "{source}"')
        if not default and not named:
            results.append(f'  side-effect: "{source}"')

    # Python imports
    for m in re.finditer(r"^(?:from\s+(\S+)\s+)?import\s+(.+)$", content, re.MULTILINE):
        module, names = m.group(1), m.group(2)
        if module:
            results.append(f"  from {module} import {names.strip()}")
        else:
            results.append(f"  import {names.strip()}")

    if len(results) == 1:
        results.append("  No imports found")

    return "\n".join(results)


def _analyze_exports(content: str, file_path: str) -> str:
    results = [f"=== Export Analysis: {file_path} ==="]

    for m in re.finditer(
        r"export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)",
        content,
    ):
        results.append(f"  named: {m.group(1)}")

    for m in re.finditer(r"export\s+default\s+(?:class|function)?\s*(\w+)?", content):
        results.append(f"  default: {m.group(1) or '(anonymous)'}")

    if len(results) == 1:
        results.append("  No exports found")

    return "\n".join(results)


def _analyze_functions(content: str, file_path: str) -> str:
    results = [f"=== Function Analysis: {file_path} ==="]

    # JS/TS functions
    for m in re.finditer(
        r"(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\S+))?",
        content,
    ):
        params = m.group(2).strip() or "none"
        ret = m.group(3) or "untyped"
        results.append(f"  function {m.group(1)}({params}): {ret}")

    # Python functions
    for m in re.finditer(r"^def\s+(\w+)\s*\(([^)]*)\)", content, re.MULTILINE):
        params = m.group(2).strip() or "none"
        results.append(f"  def {m.group(1)}({params})")

    if len(results) == 1:
        results.append("  No functions found")

    return "\n".join(results)


def _analyze_classes(content: str, file_path: str) -> str:
    results = [f"=== Class Analysis: {file_path} ==="]

    # JS/TS classes
    for m in re.finditer(
        r"(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?",
        content,
    ):
        line = f"  class {m.group(1)}"
        if m.group(2):
            line += f" extends {m.group(2)}"
        results.append(line)

    # Python classes
    for m in re.finditer(r"^class\s+(\w+)(?:\(([^)]*)\))?:", content, re.MULTILINE):
        line = f"  class {m.group(1)}"
        if m.group(2):
            line += f"({m.group(2)})"
        results.append(line)

    if len(results) == 1:
        results.append("  No classes found")

    return "\n".join(results)


def _analyze_errors(content: str, file_path: str) -> str:
    results = [f"=== Error Handling Analysis: {file_path} ==="]

    try_count = len(re.findall(r"try\s*[:{]", content))
    results.append(f"  try-catch/except blocks: {try_count}")

    throws = re.findall(r"throw\s+new\s+(\w+)", content)
    raises = re.findall(r"raise\s+(\w+)", content)
    all_thrown = throws + raises
    results.append(f"  throw/raise statements: {len(all_thrown)}")
    if all_thrown:
        results.append(f"  thrown types: {', '.join(set(all_thrown))}")

    catch_calls = len(re.findall(r"\.catch\s*\(", content))
    results.append(f"  .catch() calls: {catch_calls}")

    return "\n".join(results)


def _analyze_dependencies(content: str, file_path: str) -> str:
    results = [f"=== Dependency Analysis: {file_path} ==="]

    deps: set[str] = set()

    for m in re.finditer(r"from\s+['\"]([^'\"]+)['\"]", content):
        deps.add(m.group(1))
    for m in re.finditer(r"require\(['\"]([^'\"]+)['\"]\)", content):
        deps.add(m.group(1))
    for m in re.finditer(r"^(?:from\s+(\S+)\s+)?import", content, re.MULTILINE):
        if m.group(1):
            deps.add(m.group(1))

    local = sorted(d for d in deps if d.startswith(".") or d.startswith("/"))
    external = sorted(d for d in deps if not d.startswith(".") and not d.startswith("/"))

    results.append(f"  Local dependencies ({len(local)}):")
    for d in local:
        results.append(f"    - {d}")
    results.append(f"  External dependencies ({len(external)}):")
    for d in external:
        results.append(f"    - {d}")

    return "\n".join(results)
