"""
Database models for RepoVision.

Defines SQLModel schemas for persisting code analysis results.
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
    """

    id: int | None = Field(default=None, primary_key=True)
    file_path: str = Field(index=True, unique=True)
    complexity_score: int
    node_count: int
    last_analyzed: datetime = Field(default_factory=utc_now)

