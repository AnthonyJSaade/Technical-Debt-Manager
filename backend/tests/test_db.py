"""
Tests for database persistence and API endpoints.

TDD: These tests are written BEFORE the implementation.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, SQLModel, create_engine, select

from app.db import get_session
from app.main import app
from app.models import FileAnalysis

# Configure pytest-asyncio
pytestmark = pytest.mark.asyncio(loop_scope="function")

# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


def get_test_session():
    """Override session dependency for tests."""
    with Session(test_engine) as session:
        yield session


@pytest.fixture(autouse=True)
def setup_database():
    """Create fresh tables before each test."""
    SQLModel.metadata.create_all(test_engine)
    yield
    SQLModel.metadata.drop_all(test_engine)


@pytest.fixture
def session():
    """Provide a test database session."""
    with Session(test_engine) as session:
        yield session


@pytest.fixture
def client():
    """Create a test client with test database (sync fixture)."""
    app.dependency_overrides[get_session] = get_test_session
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestSaveAnalysis:
    """Tests for saving new analysis results."""

    @pytest.mark.asyncio
    async def test_analyze_saves_to_database(self, client: AsyncClient, session: Session) -> None:
        """
        POST /analyze should save the analysis result to the database.
        
        Given: A Python file content to analyze
        When: POST /analyze is called
        Then: The result is persisted in the FileAnalysis table
        """
        response = await client.post(
            "/analyze",
            json={"filename": "app/utils.py", "content": "if x:\n    pass"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["complexity_score"] == 1
        
        # Verify persistence
        with Session(test_engine) as verify_session:
            result = verify_session.exec(
                select(FileAnalysis).where(FileAnalysis.file_path == "app/utils.py")
            ).first()
            
            assert result is not None
            assert result.complexity_score == 1
            assert result.file_path == "app/utils.py"


class TestUpsertAnalysis:
    """Tests for updating existing analysis results (upsert behavior)."""

    @pytest.mark.asyncio
    async def test_analyze_updates_existing_file(self, client: AsyncClient) -> None:
        """
        POST /analyze should update if file_path already exists.
        
        Given: A file that has been analyzed before
        When: POST /analyze is called again with different content
        Then: The existing record is updated (not duplicated)
        """
        # First analysis
        await client.post(
            "/analyze",
            json={"filename": "app/main.py", "content": "if x:\n    pass"}
        )
        
        # Second analysis with more complexity
        response = await client.post(
            "/analyze",
            json={"filename": "app/main.py", "content": "if x:\n    for i in range(10):\n        pass"}
        )
        
        assert response.status_code == 200
        assert response.json()["complexity_score"] == 2
        
        # Verify only one record exists (upsert, not duplicate)
        with Session(test_engine) as verify_session:
            results = verify_session.exec(
                select(FileAnalysis).where(FileAnalysis.file_path == "app/main.py")
            ).all()
            
            assert len(results) == 1
            assert results[0].complexity_score == 2  # Updated value


class TestListFiles:
    """Tests for listing analyzed files."""

    @pytest.mark.asyncio
    async def test_list_files_returns_all_analyzed(self, client: AsyncClient) -> None:
        """
        GET /files should return all analyzed files.
        
        Given: Multiple files have been analyzed
        When: GET /files is called
        Then: All files are returned
        """
        # Analyze multiple files
        await client.post(
            "/analyze",
            json={"filename": "file_a.py", "content": "x = 1"}
        )
        await client.post(
            "/analyze",
            json={"filename": "file_b.py", "content": "if x:\n    pass"}
        )
        
        response = await client.get("/files")
        
        assert response.status_code == 200
        files = response.json()
        assert len(files) == 2

    @pytest.mark.asyncio
    async def test_list_files_sorted_by_complexity_descending(self, client: AsyncClient) -> None:
        """
        GET /files should return files sorted by complexity (highest first).
        
        Given: Files with different complexity scores
        When: GET /files is called
        Then: Files are ordered by complexity_score descending
        """
        # Low complexity
        await client.post(
            "/analyze",
            json={"filename": "simple.py", "content": "x = 1"}
        )
        # High complexity
        await client.post(
            "/analyze",
            json={"filename": "complex.py", "content": "if x:\n    for i in range(10):\n        while True:\n            break"}
        )
        # Medium complexity
        await client.post(
            "/analyze",
            json={"filename": "medium.py", "content": "if x:\n    pass"}
        )
        
        response = await client.get("/files")
        
        assert response.status_code == 200
        files = response.json()
        
        # Verify descending order by complexity
        assert files[0]["file_path"] == "complex.py"
        assert files[0]["complexity_score"] == 3
        assert files[1]["file_path"] == "medium.py"
        assert files[1]["complexity_score"] == 1
        assert files[2]["file_path"] == "simple.py"
        assert files[2]["complexity_score"] == 0

    @pytest.mark.asyncio
    async def test_list_files_empty_database(self, client: AsyncClient) -> None:
        """
        GET /files should return empty list when no files analyzed.
        
        Given: No files have been analyzed
        When: GET /files is called
        Then: An empty list is returned
        """
        response = await client.get("/files")
        
        assert response.status_code == 200
        assert response.json() == []

