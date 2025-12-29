"""
RepoVision Backend - FastAPI Application

The API layer for the RepoVision technical debt manager.
Provides endpoints for health checks, code analysis, and agent orchestration.
"""

from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path

# Load environment variables FIRST
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select

from app.analysis import CodeParser, scan_directory
from app.db import get_session, init_db
from app.models import FileAnalysis
from app.agents import complete_text, DockerSandbox, JanitorAgent

# Initialize Docker sandbox (gracefully handles Docker not running)
docker_sandbox = DockerSandbox()

# Initialize Janitor Agent
janitor_agent = JanitorAgent(sandbox=docker_sandbox)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler - initialize DB on startup."""
    init_db()
    yield


app = FastAPI(
    title="RepoVision API",
    description="AI-Powered Mission Control for Technical Debt",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the code parser
code_parser = CodeParser()


# ============================================================================
# Request/Response Models
# ============================================================================


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str


class AnalysisRequest(BaseModel):
    """Request model for code analysis."""

    filename: str
    content: str


class AnalysisResponse(BaseModel):
    """Response model for code analysis."""

    complexity_score: int
    node_count: int


class FileAnalysisResponse(BaseModel):
    """Response model for file analysis listing."""

    id: int
    file_path: str
    complexity_score: int
    node_count: int
    last_analyzed: datetime


class ScanRequest(BaseModel):
    """Request model for project scanning."""

    path: str | None = None  # Default to backend directory if not provided


class ScanResponse(BaseModel):
    """Response model for project scanning."""

    files_scanned: int
    total_complexity: int


class BrainTestResponse(BaseModel):
    """Response model for LLM brain test."""

    success: bool
    message: str


class SandboxTestResponse(BaseModel):
    """Response model for Docker sandbox test."""

    success: bool
    output: str


class FixRequest(BaseModel):
    """Request model for Janitor Agent fix."""

    file_path: str
    instruction: str


class FixResponse(BaseModel):
    """Response model for Janitor Agent fix."""

    status: str
    reason: str | None = None
    fixed_code: str | None = None
    repro_script: str | None = None
    attempts: int | None = None


class ApplyFixRequest(BaseModel):
    """Request model for applying a fix."""

    file_path: str
    new_code: str


class ApplyFixResponse(BaseModel):
    """Response model for applying a fix."""

    success: bool
    message: str


# ============================================================================
# Endpoints
# ============================================================================


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Health check endpoint.

    Returns:
        HealthResponse: The current health status of the API.
    """
    return HealthResponse(status="ok")


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_code(
    request: AnalysisRequest,
    session: Session = Depends(get_session),
) -> AnalysisResponse:
    """
    Analyze Python source code for complexity metrics.

    The endpoint uses Tree-sitter to parse the code and count
    control flow structures (if, for, while, try) to compute
    a complexity score. Results are persisted to the database.

    If the file has been analyzed before, the existing record is updated.

    Args:
        request: The analysis request containing filename and content.
        session: Database session (injected).

    Returns:
        AnalysisResponse: The complexity score and total node count.
    """
    result = code_parser.analyze(request.content)

    # Upsert: update if exists, insert if new
    existing = session.exec(
        select(FileAnalysis).where(FileAnalysis.file_path == request.filename)
    ).first()

    if existing:
        existing.complexity_score = result["complexity_score"]
        existing.node_count = result["node_count"]
        existing.last_analyzed = datetime.now(UTC)
        session.add(existing)
    else:
        file_analysis = FileAnalysis(
            file_path=request.filename,
            complexity_score=result["complexity_score"],
            node_count=result["node_count"],
        )
        session.add(file_analysis)

    session.commit()

    return AnalysisResponse(
        complexity_score=result["complexity_score"],
        node_count=result["node_count"],
    )


@app.get("/files", response_model=list[FileAnalysisResponse])
async def list_files(
    session: Session = Depends(get_session),
) -> list[FileAnalysisResponse]:
    """
    List all analyzed files sorted by complexity (descending).

    Returns:
        list[FileAnalysisResponse]: All analyzed files, highest complexity first.
    """
    files = session.exec(
        select(FileAnalysis).order_by(FileAnalysis.complexity_score.desc())
    ).all()

    return [
        FileAnalysisResponse(
            id=f.id,  # type: ignore[arg-type]
            file_path=f.file_path,
            complexity_score=f.complexity_score,
            node_count=f.node_count,
            last_analyzed=f.last_analyzed,
        )
        for f in files
    ]


@app.post("/scan", response_model=ScanResponse)
async def scan_project(
    request: ScanRequest,
    session: Session = Depends(get_session),
) -> ScanResponse:
    """
    Scan a directory for Python files and analyze them.

    If no path is provided, defaults to scanning the backend directory.

    Args:
        request: The scan request with optional path.
        session: Database session (injected).

    Returns:
        ScanResponse: Count of files scanned and total complexity.
    """
    # Default to scanning the backend directory
    if request.path is None:
        scan_path = str(Path(__file__).parent.parent)
    else:
        scan_path = request.path

    # Scan and get results
    results = scan_directory(scan_path)

    total_complexity = 0

    # Persist each result (upsert)
    for result in results:
        existing = session.exec(
            select(FileAnalysis).where(FileAnalysis.file_path == result["file_path"])
        ).first()

        if existing:
            existing.complexity_score = result["complexity_score"]
            existing.node_count = result["node_count"]
            existing.last_analyzed = datetime.now(UTC)
            session.add(existing)
        else:
            file_analysis = FileAnalysis(
                file_path=result["file_path"],
                complexity_score=result["complexity_score"],
                node_count=result["node_count"],
            )
            session.add(file_analysis)

        total_complexity += result["complexity_score"]

    session.commit()

    return ScanResponse(
        files_scanned=len(results),
        total_complexity=total_complexity,
    )


# ============================================================================
# Agent Test Endpoints
# ============================================================================


@app.post("/test-brain", response_model=BrainTestResponse)
async def test_brain() -> BrainTestResponse:
    """
    Test the LLM brain connection (Groq/Llama 3).

    Sends a simple prompt to verify the API is working.

    Returns:
        BrainTestResponse: Success status and response message.
    """
    try:
        response = await complete_text("Say 'Hello from Groq!' in exactly those words.")
        return BrainTestResponse(success=True, message=response)
    except Exception as e:
        return BrainTestResponse(success=False, message=f"Error: {str(e)}")


@app.post("/test-sandbox", response_model=SandboxTestResponse)
async def test_sandbox() -> SandboxTestResponse:
    """
    Test the Docker sandbox.

    Runs a simple Python print statement in a container.

    Returns:
        SandboxTestResponse: Success status and output.
    """
    code = "print('Hello from Docker!')"
    output = docker_sandbox.run_code(code)

    success = "Hello from Docker!" in output
    return SandboxTestResponse(success=success, output=output)


# ============================================================================
# Janitor Agent Endpoints
# ============================================================================


@app.post("/fix", response_model=FixResponse)
async def fix_bug(request: FixRequest) -> FixResponse:
    """
    Use the Janitor Agent to fix a bug in a Python file.

    The agent follows a TDD loop:
    1. Generate a reproduction script (must fail on buggy code)
    2. Generate a fix (retry up to 3 times)
    3. Verify the fix passes the reproduction script

    Args:
        request: The fix request with file_path and instruction.

    Returns:
        FixResponse: The result of the fix attempt.
    """
    result = await janitor_agent.solve(
        file_path=request.file_path,
        bug_desc=request.instruction,
    )

    return FixResponse(
        status=result.get("status", "failed"),
        reason=result.get("reason"),
        fixed_code=result.get("fixed_code"),
        repro_script=result.get("repro_script"),
        attempts=result.get("attempts"),
    )


@app.post("/apply-fix", response_model=ApplyFixResponse)
async def apply_fix(request: ApplyFixRequest) -> ApplyFixResponse:
    """
    Apply a fix by overwriting a file on disk.

    Args:
        request: The apply request with file_path and new_code.

    Returns:
        ApplyFixResponse: Success status and message.
    """
    try:
        file_path = Path(request.file_path)

        if not file_path.exists():
            return ApplyFixResponse(
                success=False,
                message=f"File not found: {request.file_path}",
            )

        # Write the new code to the file
        file_path.write_text(request.new_code, encoding="utf-8")

        return ApplyFixResponse(
            success=True,
            message=f"Successfully updated {file_path.name}",
        )
    except Exception as e:
        return ApplyFixResponse(
            success=False,
            message=f"Failed to apply fix: {str(e)}",
        )
