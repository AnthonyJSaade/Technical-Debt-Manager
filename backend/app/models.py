"""
Database models for RepoVision.

Defines SQLModel schemas for persisting code analysis results with
advanced metrics: Cognitive Complexity, Maintainability Index, SQALE Debt.
"""

from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    """Return timezone-aware UTC datetime."""
    return datetime.now(UTC)


class FileAnalysis(SQLModel, table=True):
    """
    Model representing a code file analysis result.

    Stores complexity metrics and metadata for analyzed Python files.
    Includes industry-standard metrics:
    - Cognitive Complexity (with nesting penalty)
    - Maintainability Index (0-100)
    - SQALE Technical Debt (hours)
    """

    id: int | None = Field(default=None, primary_key=True)
    file_path: str = Field(index=True, unique=True)
    
    # Legacy metrics
    complexity_score: int  # Cyclomatic complexity
    node_count: int
    
    # Advanced metrics
    cognitive_complexity: int = Field(default=0)
    halstead_volume: float = Field(default=0.0)
    maintainability_index: float = Field(default=100.0)  # 0-100, higher is better
    sqale_debt_hours: float = Field(default=0.0)  # Estimated remediation time
    lines_of_code: int = Field(default=0)
    
    # Auto-documentation
    description: str | None = Field(default=None)  # Module-level docstring
    
    # Metadata
    last_analyzed: datetime = Field(default_factory=utc_now)
