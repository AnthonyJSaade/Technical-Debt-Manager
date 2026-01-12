"""
Code Analysis Module.

Provides Tree-sitter based parsing and complexity analysis for Python code.
"""

from .parser import CodeParser
from .scanner import scan_directory

__all__ = ["CodeParser", "scan_directory"]
