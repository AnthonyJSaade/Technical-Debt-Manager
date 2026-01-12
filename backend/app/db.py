"""
Database configuration and session management.

Provides SQLite engine setup and FastAPI dependency for database sessions.
"""

from collections.abc import Generator
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

# Database file path (in backend directory)
DATABASE_PATH = Path(__file__).parent.parent / "repo.db"
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# Create engine with check_same_thread=False for FastAPI async compatibility
engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    """
    Initialize the database by creating all tables.

    Should be called on application startup.
    """
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a database session.

    Yields:
        Session: A SQLModel database session.

    Example:
        @app.get("/items")
        def get_items(session: Session = Depends(get_session)):
            return session.exec(select(Item)).all()
    """
    with Session(engine) as session:
        yield session
