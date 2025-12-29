"""
Tests for the project scanner.

TDD: These tests are written BEFORE the implementation.
"""

import tempfile
from pathlib import Path

import pytest

from app.analysis.scanner import scan_directory


class TestScanDirectory:
    """Tests for the scan_directory function."""

    def test_scan_finds_python_files(self, tmp_path: Path) -> None:
        """
        scan_directory should find all .py files in a directory.
        
        Given: A directory with Python files
        When: scan_directory is called
        Then: All .py files are found and analyzed
        """
        # Create test files
        (tmp_path / "main.py").write_text("x = 1")
        (tmp_path / "utils.py").write_text("if x:\n    pass")
        (tmp_path / "readme.txt").write_text("Not a Python file")
        
        results = scan_directory(str(tmp_path))
        
        assert len(results) == 2
        paths = {r["file_path"] for r in results}
        assert any("main.py" in p for p in paths)
        assert any("utils.py" in p for p in paths)

    def test_scan_recursive(self, tmp_path: Path) -> None:
        """
        scan_directory should recursively search subdirectories.
        
        Given: A directory with nested Python files
        When: scan_directory is called
        Then: Files in subdirectories are found
        """
        # Create nested structure
        subdir = tmp_path / "subpackage"
        subdir.mkdir()
        (tmp_path / "root.py").write_text("x = 1")
        (subdir / "nested.py").write_text("y = 2")
        
        results = scan_directory(str(tmp_path))
        
        assert len(results) == 2
        paths = {r["file_path"] for r in results}
        assert any("root.py" in p for p in paths)
        assert any("nested.py" in p for p in paths)

    def test_scan_ignores_venv(self, tmp_path: Path) -> None:
        """
        scan_directory should ignore venv directories.
        
        Given: A directory with a venv folder
        When: scan_directory is called
        Then: Files in venv are not scanned
        """
        venv = tmp_path / "venv"
        venv.mkdir()
        (tmp_path / "app.py").write_text("x = 1")
        (venv / "activate.py").write_text("# venv file")
        
        results = scan_directory(str(tmp_path))
        
        assert len(results) == 1
        # Check that no result path ends with the venv file
        assert not any("activate.py" in r["file_path"] for r in results)

    def test_scan_ignores_pycache(self, tmp_path: Path) -> None:
        """
        scan_directory should ignore __pycache__ directories.
        
        Given: A directory with __pycache__
        When: scan_directory is called
        Then: Files in __pycache__ are not scanned
        """
        pycache = tmp_path / "__pycache__"
        pycache.mkdir()
        (tmp_path / "app.py").write_text("x = 1")
        (pycache / "app.cpython-311.pyc").write_text("# bytecode")
        
        results = scan_directory(str(tmp_path))
        
        assert len(results) == 1
        assert "__pycache__" not in results[0]["file_path"]

    def test_scan_ignores_git(self, tmp_path: Path) -> None:
        """
        scan_directory should ignore .git directories.
        
        Given: A directory with .git folder
        When: scan_directory is called
        Then: Files in .git are not scanned
        """
        git = tmp_path / ".git"
        git.mkdir()
        (tmp_path / "app.py").write_text("x = 1")
        (git / "hooks.py").write_text("# git hook")
        
        results = scan_directory(str(tmp_path))
        
        assert len(results) == 1
        assert ".git" not in results[0]["file_path"]

    def test_scan_returns_complexity_scores(self, tmp_path: Path) -> None:
        """
        scan_directory should return complexity scores for each file.
        
        Given: Python files with different complexity
        When: scan_directory is called
        Then: Each result includes complexity_score and node_count
        """
        (tmp_path / "simple.py").write_text("x = 1")
        (tmp_path / "complex.py").write_text("if x:\n    for i in range(10):\n        pass")
        
        results = scan_directory(str(tmp_path))
        
        for result in results:
            assert "complexity_score" in result
            assert "node_count" in result
            assert isinstance(result["complexity_score"], int)

    def test_scan_empty_directory(self, tmp_path: Path) -> None:
        """
        scan_directory should handle empty directories gracefully.
        
        Given: An empty directory
        When: scan_directory is called
        Then: An empty list is returned
        """
        results = scan_directory(str(tmp_path))
        
        assert results == []

