"""
Project scanner for analyzing Python files in a directory.

Recursively scans directories and analyzes Python files for complexity metrics.
"""

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


def scan_directory(path: str) -> list[dict]:
    """
    Recursively scan a directory for Python files and analyze them.

    Ignores common non-source directories like venv, __pycache__, .git, etc.

    Args:
        path: The root directory path to scan.

    Returns:
        A list of analysis results, each containing:
            - file_path: Relative path to the file
            - complexity_score: Number of control flow structures
            - node_count: Total AST nodes
    """
    root = Path(path).resolve()
    parser = CodeParser()
    results: list[dict] = []

    if not root.exists():
        return results

    for py_file in root.rglob("*.py"):
        # Skip ignored directories
        if any(ignored in py_file.parts for ignored in IGNORE_DIRS):
            continue

        try:
            content = py_file.read_text(encoding="utf-8")
            analysis = parser.analyze(content)

            results.append({
                "file_path": str(py_file),
                "complexity_score": analysis["complexity_score"],
                "node_count": analysis["node_count"],
            })
        except (OSError, UnicodeDecodeError):
            # Skip files that can't be read
            continue

    return results

