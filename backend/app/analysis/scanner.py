"""
Project scanner for analyzing Python files in a directory.

Recursively scans directories and analyzes Python files for complexity metrics
including Cognitive Complexity, Maintainability Index, and SQALE Debt.
"""

import asyncio
from pathlib import Path

from app.analysis.parser import CodeParser

# Directories to ignore during scanning
IGNORE_DIRS = frozenset({
    "venv",
    ".venv",
    "env",
    ".env",
    "__pycache__",
    ".git",
    ".hg",
    ".svn",
    "node_modules",
    ".tox",
    ".pytest_cache",
    ".mypy_cache",
    "dist",
    "build",
    "egg-info",
})

async def scan_directory(path: str) -> list[dict]:
    """
    Recursively scan a directory for Python files and analyze them.
    
    Args:
        path: The root directory path to scan.

    Returns:
        A list of analysis results.
    """
    root = Path(path).resolve()
    parser = CodeParser()
    results: list[dict] = []

    if not root.exists():
        return results
    
    # First pass: Collect all files
    files_to_process = []
    for py_file in root.rglob("*.py"):
        if any(ignored in py_file.parts for ignored in IGNORE_DIRS):
            continue
        files_to_process.append(py_file)

    # Simplified sync processing since parser is CPU bound anyway
    # and we removed the async LLM call.
    for py_file in files_to_process:
        try:
            content = py_file.read_text(encoding="utf-8")
            analysis = parser.analyze(content)
            
            results.append({
                "file_path": str(py_file),
                "complexity_score": analysis["complexity_score"],
                "node_count": analysis["node_count"],
                "cognitive_complexity": analysis["cognitive_complexity"],
                "halstead_volume": analysis["halstead_volume"],
                "maintainability_index": analysis["maintainability_index"],
                "sqale_debt_hours": analysis["sqale_debt_hours"],
                "lines_of_code": analysis["lines_of_code"],
                "description": analysis["description"], # Static docstring or None
            })
        except (OSError, UnicodeDecodeError):
            continue

    return results

