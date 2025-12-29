"""
Tree-sitter based Python code parser.

This module provides AST parsing and complexity analysis using Tree-sitter.
"""

import tree_sitter_python as tspython
from tree_sitter import Language, Parser, Node


# Complexity-contributing node types
COMPLEXITY_NODES = frozenset({
    "if_statement",
    "for_statement",
    "while_statement",
    "try_statement",
})


class CodeParser:
    """
    Tree-sitter based parser for Python source code.

    Parses Python code into an AST and provides complexity metrics
    based on control flow structures.
    """

    def __init__(self) -> None:
        """Initialize the parser with Python grammar."""
        self._language = Language(tspython.language())
        self._parser = Parser(self._language)

    def parse(self, source_code: str) -> Node:
        """
        Parse Python source code into an AST.

        Args:
            source_code: The Python source code string to parse.

        Returns:
            The root node of the parsed AST.
        """
        tree = self._parser.parse(bytes(source_code, "utf-8"))
        return tree.root_node

    def analyze(self, source_code: str) -> dict[str, int]:
        """
        Analyze Python source code and return complexity metrics.

        Uses a single O(n) traversal via tree.walk() to count both
        total nodes and complexity-contributing nodes simultaneously.

        The complexity score is based on counting control flow structures:
        - if statements
        - for loops
        - while loops
        - try blocks

        Args:
            source_code: The Python source code string to analyze.

        Returns:
            A dictionary containing:
                - complexity_score: Count of control flow structures
                - node_count: Total number of AST nodes
        """
        tree = self._parser.parse(bytes(source_code, "utf-8"))
        cursor = tree.walk()

        node_count = 0
        complexity_score = 0

        # Single-pass traversal using tree cursor
        while True:
            node_count += 1
            if cursor.node.type in COMPLEXITY_NODES:
                complexity_score += 1

            # Depth-first traversal: try child, then sibling, then backtrack
            if cursor.goto_first_child():
                continue
            if cursor.goto_next_sibling():
                continue

            # Backtrack until we find an unvisited sibling
            while True:
                if not cursor.goto_parent():
                    # We've traversed the entire tree
                    return {
                        "complexity_score": complexity_score,
                        "node_count": node_count,
                    }
                if cursor.goto_next_sibling():
                    break

        return {
            "complexity_score": complexity_score,
            "node_count": node_count,
        }
