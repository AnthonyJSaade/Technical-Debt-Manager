"""
Project scanner for analyzing Python files in a directory.

Recursively scans directories and analyzes Python files for complexity metrics
including Cognitive Complexity, Maintainability Index, and SQALE Debt.
"""

import asyncio
from pathlib import Path

from app.analysis.parser import CodeParser
from app.agents.llm import complete_text as llm_complete

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

# Semaphore to limit concurrent LLM calls
SEM = asyncio.Semaphore(5)

async def generate_description(content: str, filename: str) -> str:
    """Generate a brief description of the file using the LLM."""
    async with SEM:
        try:
            # Simple summarization prompt
            prompt = (
                f"Analyze the following Python file '{filename}' and provide a VERY BRIEF (1-2 sentences) "
                "summary of its purpose. Do not mention specific function names unless critical. "
                "Start with 'Handles...', 'Provides...', 'Defines...' etc.\n\n"
                f"File Content (truncated):\n{content[:2000]}"
            )
            return await llm_complete(prompt)
        except Exception:
            return "Analysis failed."

async def scan_directory(path: str) -> list[dict]:
    """
    Recursively scan a directory for Python files and analyze them.
    Asynchronous to allow concurrent LLM description generation.

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

    tasks = []
    
    # First pass: Collect all files and do static analysis
    files_to_process = []
    for py_file in root.rglob("*.py"):
        if any(ignored in py_file.parts for ignored in IGNORE_DIRS):
            continue
        files_to_process.append(py_file)

    async def process_file(py_file: Path):
        try:
            content = py_file.read_text(encoding="utf-8")
            analysis = parser.analyze(content)
            
            # Use AI if no docstring is present
            description = analysis["description"]
            if not description or len(description.strip()) < 10:
                # Fallback to AI generation
                # Only if file is not empty
                if content.strip():
                     description = await generate_description(content, py_file.name)
            
            return {
                "file_path": str(py_file),
                "complexity_score": analysis["complexity_score"],
                "node_count": analysis["node_count"],
                "cognitive_complexity": analysis["cognitive_complexity"],
                "halstead_volume": analysis["halstead_volume"],
                "maintainability_index": analysis["maintainability_index"],
                "sqale_debt_hours": analysis["sqale_debt_hours"],
                "lines_of_code": analysis["lines_of_code"],
                "description": description,
            }
        except (OSError, UnicodeDecodeError):
            return None

    # Run all file processing concurrently
    # Note: parser.analyze is CPU bound (sync), so we might block the event loop slightly.
    # ideally we run parser in a threadpool, but for now direct call is okay as it's fast.
    # The LLM call inside is async.
    
    tasks = [process_file(f) for f in files_to_process]
    results_raw = await asyncio.gather(*tasks)
    
    # Filter out None results
    results = [r for r in results_raw if r is not None]

    return results
