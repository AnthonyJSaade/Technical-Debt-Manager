"""
Tests for the CodeParser class.

These tests verify Tree-sitter based complexity analysis.
Written retroactively to enforce TDD discipline going forward.
"""

import pytest

from app.analysis import CodeParser


@pytest.fixture
def parser() -> CodeParser:
    """Create a CodeParser instance for testing."""
    return CodeParser()


class TestCodeParserComplexity:
    """Tests for complexity score calculation."""

    def test_empty_code(self, parser: CodeParser) -> None:
        """
        Empty code should be handled gracefully.
        
        Expected: complexity_score = 0, node_count >= 1 (module node).
        """
        result = parser.analyze("")
        assert result["complexity_score"] == 0
        assert result["node_count"] >= 1  # At minimum, the module node

    def test_simple_complexity(self, parser: CodeParser) -> None:
        """
        A function with one if statement should have complexity 1.
        
        Code:
            def check(x):
                if x > 0:
                    return True
                return False
        
        Expected: complexity_score = 1 (one if statement).
        """
        code = """def check(x):
    if x > 0:
        return True
    return False"""
        result = parser.analyze(code)
        assert result["complexity_score"] == 1

    def test_nested_complexity(self, parser: CodeParser) -> None:
        """
        A for loop inside an if statement should have complexity 2.
        
        Code:
            def process(items):
                if items:
                    for item in items:
                        print(item)
        
        Expected: complexity_score = 2 (if + for).
        """
        code = """def process(items):
    if items:
        for item in items:
            print(item)"""
        result = parser.analyze(code)
        assert result["complexity_score"] == 2

