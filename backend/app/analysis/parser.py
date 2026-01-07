"""
Tree-sitter based Python code parser.

This module provides AST parsing and advanced complexity metrics using Tree-sitter:
- Cognitive Complexity (with nesting depth penalty)
- Halstead Volume (operator/operand counting)
- Maintainability Index (0-100 scale)
- SQALE Technical Debt (estimated hours)
"""

import math
from dataclasses import dataclass

import tree_sitter_python as tspython
from tree_sitter import Language, Parser, Node


# Control flow structures that add to cognitive complexity
# Each of these adds +1 base complexity + nesting depth penalty
CONTROL_FLOW_NODES = frozenset({
    "if_statement",
    "for_statement",
    "while_statement",
    "try_statement",
    "except_clause",
    "with_statement",
    "match_statement",  # Python 3.10+
    "else_clause",      # else: branch (counts as +1 at current depth)
    "elif_clause",      # elif: branch (counts as +1 at current depth)
})

# Operators for Halstead calculation
OPERATOR_NODES = frozenset({
    "binary_operator",
    "unary_operator",
    "comparison_operator",
    "boolean_operator",
    "augmented_assignment",
    "assignment",
    "not_operator",
})

# Keywords that count as operators
OPERATOR_KEYWORDS = frozenset({
    "if", "else", "elif", "for", "while", "try", "except", "finally",
    "with", "return", "yield", "raise", "break", "continue", "pass",
    "import", "from", "as", "def", "class", "lambda", "and", "or", "not",
    "in", "is", "await", "async", "match", "case",
})

# Operand node types
OPERAND_NODES = frozenset({
    "identifier",
    "integer",
    "float",
    "string",
    "true",
    "false",
    "none",
})


@dataclass
class AnalysisResult:
    """Results from code analysis."""
    
    node_count: int
    complexity_score: int  # Legacy cyclomatic complexity
    cognitive_complexity: int
    halstead_volume: float
    maintainability_index: float
    sqale_debt_hours: float
    lines_of_code: int


class CodeParser:
    """
    Tree-sitter based parser for Python source code.

    Parses Python code into an AST and provides advanced complexity metrics
    including Cognitive Complexity, Halstead Volume, and Maintainability Index.
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

    def _calculate_cognitive_complexity(self, root: Node) -> int:
        """
        Calculate Cognitive Complexity with nesting depth penalty.

        Rules:
        1. +1 for each control structure (if, for, while, try, else, elif, etc.)
        2. +1 extra for each level of nesting depth (determined by Python blocks)

        Nesting is determined by Python's "block" nodes, which represent indented
        code blocks. This respects Python's indentation structure as the source
        of truth for nesting depth.

        Important: Blocks that are direct children of function_definition,
        class_definition, or module do NOT increment nesting. These are
        "encapsulation blocks" that establish scope, not complexity nesting.
        Code inside a function should start at nesting level 0.

        Args:
            root: The root AST node.

        Returns:
            The cognitive complexity score.
        """
        # Nodes whose block children should NOT increment nesting depth
        # (encapsulation patterns, not complexity nesting)
        ENCAPSULATION_NODES = frozenset({
            "function_definition",
            "class_definition",
            "module",
        })

        complexity = 0

        def traverse(node: Node, nesting_depth: int) -> None:
            nonlocal complexity

            # Check if this node contributes to cognitive complexity
            if node.type in CONTROL_FLOW_NODES:
                # Base increment + nesting penalty
                complexity += 1 + nesting_depth

            # Traverse children with appropriate nesting depth
            for child in node.children:
                # "block" nodes represent indented code in Python
                # They increment nesting UNLESS they're encapsulation blocks
                # (function/class/module body blocks start at depth 0)
                if child.type == "block":
                    if node.type in ENCAPSULATION_NODES:
                        # Function/class body: don't increment depth
                        traverse(child, nesting_depth)
                    else:
                        # Control structure body: increment depth
                        traverse(child, nesting_depth + 1)
                else:
                    traverse(child, nesting_depth)

        traverse(root, 0)
        return complexity

    def _calculate_halstead_metrics(self, root: Node) -> tuple[float, int, int]:
        """
        Calculate Halstead metrics (Volume, operators, operands).

        Volume = (N1 + N2) * log2(n1 + n2)
        where:
        - N1 = total operators
        - N2 = total operands
        - n1 = unique operators
        - n2 = unique operands

        Args:
            root: The root AST node.

        Returns:
            Tuple of (volume, total_operators, total_operands).
        """
        operators: list[str] = []
        operands: list[str] = []

        def traverse(node: Node) -> None:
            # Count operators
            if node.type in OPERATOR_NODES:
                operators.append(node.type)
            elif node.type == "keyword" and node.text:
                keyword = node.text.decode("utf-8")
                if keyword in OPERATOR_KEYWORDS:
                    operators.append(keyword)
            
            # Count operands
            if node.type in OPERAND_NODES:
                operand_text = node.text.decode("utf-8") if node.text else node.type
                operands.append(operand_text)

            for child in node.children:
                traverse(child)

        traverse(root)

        n1 = len(operators)  # Total operators
        n2 = len(operands)   # Total operands
        unique_n1 = len(set(operators))  # Unique operators
        unique_n2 = len(set(operands))   # Unique operands

        # Avoid log(0)
        vocabulary = unique_n1 + unique_n2
        if vocabulary == 0:
            return 0.0, n1, n2

        program_length = n1 + n2
        volume = program_length * math.log2(vocabulary) if vocabulary > 0 else 0.0

        return volume, n1, n2

    def _calculate_maintainability_index(
        self,
        halstead_volume: float,
        cyclomatic_complexity: int,
        lines_of_code: int
    ) -> float:
        """
        Calculate the Maintainability Index (0-100 scale).

        Formula: MAX(0, (171 - 5.2*ln(V) - 0.23*CC - 16.2*ln(LOC)) * 100 / 171)

        Higher is better:
        - 85-100: Highly maintainable
        - 65-85: Moderately maintainable
        - 0-65: Difficult to maintain

        Args:
            halstead_volume: The Halstead volume.
            cyclomatic_complexity: The cyclomatic complexity.
            lines_of_code: Number of lines of code.

        Returns:
            Maintainability index (0-100).
        """
        # Avoid log(0) or log(negative)
        v = max(halstead_volume, 1.0)
        loc = max(lines_of_code, 1)
        cc = max(cyclomatic_complexity, 1)

        mi_raw = 171 - 5.2 * math.log(v) - 0.23 * cc - 16.2 * math.log(loc)
        mi_normalized = max(0, mi_raw * 100 / 171)

        return round(min(100, mi_normalized), 2)

    def _count_lines_of_code(self, source_code: str) -> int:
        """
        Count non-empty, non-comment lines of code.

        Args:
            source_code: The source code string.

        Returns:
            Number of logical lines of code.
        """
        lines = source_code.split("\n")
        loc = 0
        for line in lines:
            stripped = line.strip()
            # Skip empty lines and comments
            if stripped and not stripped.startswith("#"):
                loc += 1
        return max(loc, 1)  # Minimum 1 to avoid division issues

    def _extract_module_docstring(self, root: Node) -> str | None:
        """
        Extract the module-level docstring from the AST.

        The module docstring is the first string literal in the file,
        typically an expression_statement containing a string node
        at the top level of the module.

        Args:
            root: The root AST node (module).

        Returns:
            The docstring text, or None if not present.
        """
        # The module's children are top-level statements
        for child in root.children:
            # Look for expression_statement containing a string
            if child.type == "expression_statement":
                for subchild in child.children:
                    if subchild.type == "string":
                        # Extract the string content
                        text = subchild.text.decode("utf-8") if subchild.text else None
                        if text:
                            # Remove quotes (single, double, triple)
                            # Handle triple quotes first
                            if text.startswith('"""') and text.endswith('"""'):
                                return text[3:-3].strip()
                            elif text.startswith("'''") and text.endswith("'''"):
                                return text[3:-3].strip()
                            elif text.startswith('"') and text.endswith('"'):
                                return text[1:-1].strip()
                            elif text.startswith("'") and text.endswith("'"):
                                return text[1:-1].strip()
                            return text.strip()
                # Only check the first expression_statement
                break
            # If we hit a non-expression statement first, no docstring
            elif child.type not in ("comment",):
                break
        return None

    def analyze(self, source_code: str) -> dict[str, int | float | str | None]:
        """
        Analyze Python source code and return comprehensive metrics.

        Metrics calculated:
        - node_count: Total AST nodes
        - complexity_score: Legacy cyclomatic complexity (control structures)
        - cognitive_complexity: With nesting depth penalty
        - halstead_volume: Program volume estimate
        - maintainability_index: 0-100 (higher is better)
        - sqale_debt_hours: Estimated remediation time
        - lines_of_code: Non-empty, non-comment lines

        Args:
            source_code: The Python source code string to analyze.

        Returns:
            Dictionary with all calculated metrics.
        """
        # Handle empty input
        if not source_code or not source_code.strip():
            return {
                "complexity_score": 0,
                "node_count": 0,
                "cognitive_complexity": 0,
                "halstead_volume": 0.0,
                "maintainability_index": 100.0,
                "sqale_debt_hours": 0.0,
                "lines_of_code": 0,
                "description": None,
            }

        tree = self._parser.parse(bytes(source_code, "utf-8"))
        root = tree.root_node

        # Count nodes and legacy complexity using cursor (efficient)
        cursor = tree.walk()
        node_count = 0
        complexity_score = 0

        while True:
            node_count += 1
            if cursor.node.type in CONTROL_FLOW_NODES:
                complexity_score += 1

            if cursor.goto_first_child():
                continue
            if cursor.goto_next_sibling():
                continue

            while True:
                if not cursor.goto_parent():
                    break
                if cursor.goto_next_sibling():
                    break
            else:
                continue
            break

        # Calculate advanced metrics
        cognitive_complexity = self._calculate_cognitive_complexity(root)
        halstead_volume, _, _ = self._calculate_halstead_metrics(root)
        lines_of_code = self._count_lines_of_code(source_code)
        maintainability_index = self._calculate_maintainability_index(
            halstead_volume, complexity_score, lines_of_code
        )

        # SQALE debt: 0.15 hours (~9 mins) per cognitive complexity point
        # This produces realistic remediation estimates (e.g., 11 points = ~1.6 hours)
        sqale_debt_hours = round(cognitive_complexity * 0.15, 2)

        # Extract module-level docstring for auto-documentation
        description = self._extract_module_docstring(root)

        return {
            "complexity_score": complexity_score,
            "node_count": node_count,
            "cognitive_complexity": cognitive_complexity,
            "halstead_volume": round(halstead_volume, 2),
            "maintainability_index": maintainability_index,
            "sqale_debt_hours": sqale_debt_hours,
            "lines_of_code": lines_of_code,
            "description": description,
        }
