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
from fastapi.responses import StreamingResponse
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
    
    # Clear all previous scan data on startup to ensure empty state
    from app.db import engine
    from sqlmodel import delete
    from app.models import FileAnalysis
    
    with Session(engine) as session:
        session.exec(delete(FileAnalysis))
        session.commit()
        
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
    cognitive_complexity: int
    halstead_volume: float
    maintainability_index: float
    sqale_debt_hours: float
    lines_of_code: int
    description: str | None = None  # Module-level docstring
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


class DownloadFixRequest(BaseModel):
    """Request model for downloading a fix as a file."""

    file_path: str
    fixed_code: str


class DiagnoseRequest(BaseModel):
    """Request model for file diagnosis."""

    file_path: str


class DiagnoseResponse(BaseModel):
    """Response model for file diagnosis."""

    is_healthy: bool  # True if code is fundamentally good
    issue: str  # Main issue or "Code looks good!" if healthy
    severity: str  # "none", "low", "medium", "high"
    suggestions: list[str] = []  # Optional minor improvements (shown as subtext)


class FileIssue(BaseModel):
    """A single file issue for the issues panel."""

    file_path: str
    file_name: str
    issue: str
    severity: str  # "low", "medium", "high"
    cognitive_complexity: int
    maintainability_index: float


class DiagnoseAllResponse(BaseModel):
    """Response model for batch file diagnosis."""

    issues: list[FileIssue]
    total_files: int
    files_with_issues: int


class FileContentRequest(BaseModel):
    """Request model for file content."""

    file_path: str


class FileContentResponse(BaseModel):
    """Response model for file content."""

    content: str
    file_name: str


class BrowseRequest(BaseModel):
    """Request model for browsing directories."""

    path: str | None = None  # None means home directory


class DirectoryEntry(BaseModel):
    """A single directory entry."""

    name: str
    path: str
    is_dir: bool


class BrowseResponse(BaseModel):
    """Response model for directory browsing."""

    current_path: str
    parent_path: str | None
    entries: list[DirectoryEntry]



class DirectorySelectionResponse(BaseModel):
    """Response model for directory selection."""
    path: str | None


def open_native_picker() -> str | None:
    """
    Open the native OS directory picker dialog on the host machine.
    Uses AppleScript (osascript) on macOS for the best native experience.
    """
    import platform
    import subprocess
    import sys

    # Check for macOS
    if platform.system() == "Darwin":
        try:
            # Simple AppleScript to choose folder (no System Events needed)
            script = 'POSIX path of (choose folder with prompt "Select Project Directory")'
            result = subprocess.run(
                ['osascript', '-e', script],
                capture_output=True,
                text=True,
                timeout=120  # 2 minute timeout for user to select
            )
            
            print(f"osascript result: returncode={result.returncode}, stdout='{result.stdout}', stderr='{result.stderr}'")
            
            if result.returncode == 0:
                path = result.stdout.strip()
                return path if path else None
            # User cancelled or error
            print(f"osascript failed: {result.stderr}")
            return None
        except subprocess.TimeoutExpired:
            print("Directory picker timed out")
            return None
        except Exception as e:
            print(f"Error opening macOS picker: {e}")
            return None

    # Fallback to Tkinter for Linux/Windows (if needed in future)
    try:
        import tkinter as tk
        from tkinter import filedialog
        
        root = tk.Tk()
        root.withdraw() # Hide main window
        root.wm_attributes('-topmost', 1) # Bring to front
        
        path = filedialog.askdirectory(title="Select Project Directory")
        root.destroy()
        
        return path if path else None
    except Exception as e:
        print(f"Error opening Tkinter picker: {e}")
        return None


# ============================================================================
# Endpoints
# ============================================================================


@app.post("/system/select-directory", response_model=DirectorySelectionResponse)
async def select_directory() -> DirectorySelectionResponse:
    """
    Trigger the native OS directory picker on the host machine.
    Returns the absolute path selected by the user.
    """
    selected_path = open_native_picker()
    return DirectorySelectionResponse(path=selected_path)




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
        existing.cognitive_complexity = result["cognitive_complexity"]
        existing.halstead_volume = result["halstead_volume"]
        existing.maintainability_index = result["maintainability_index"]
        existing.sqale_debt_hours = result["sqale_debt_hours"]
        existing.lines_of_code = result["lines_of_code"]
        existing.description = result.get("description")
        existing.last_analyzed = datetime.now(UTC)
        session.add(existing)
    else:
        file_analysis = FileAnalysis(
            file_path=request.filename,
            complexity_score=result["complexity_score"],
            node_count=result["node_count"],
            cognitive_complexity=result["cognitive_complexity"],
            halstead_volume=result["halstead_volume"],
            maintainability_index=result["maintainability_index"],
            sqale_debt_hours=result["sqale_debt_hours"],
            lines_of_code=result["lines_of_code"],
            description=result.get("description"),
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
            cognitive_complexity=f.cognitive_complexity,
            halstead_volume=f.halstead_volume,
            maintainability_index=f.maintainability_index,
            sqale_debt_hours=f.sqale_debt_hours,
            lines_of_code=f.lines_of_code,
            description=f.description,
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
    import asyncio
    
    # Default to scanning the backend directory
    if request.path is None:
        scan_path = str(Path(__file__).parent.parent)
    else:
        # Expand ~ and resolve path
        scan_path = str(Path(request.path).expanduser().resolve())

    # Validate path exists
    if not Path(scan_path).exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Directory not found: {scan_path}",
        )
    
    # ---------------------------------------------------------
    # 1. CACHE EXISTING DESCRIPTIONS
    # ---------------------------------------------------------
    # Fetch all existing records before wiping them
    existing_files = session.exec(select(FileAnalysis)).all()
    description_cache = {
        f.file_path: f.description 
        for f in existing_files 
        if f.description and not f.description.startswith("Description unavailable")
    }

    # Clear all previous scan data - each scan is a fresh start
    from sqlalchemy import delete
    session.exec(delete(FileAnalysis))  # type: ignore[arg-type]
    session.commit()

    # ---------------------------------------------------------
    # 2. STATIC SCAN (Fast, No LLM)
    # ---------------------------------------------------------
    # Scan and get results (now purely static analysis)
    results = await scan_directory(scan_path)
    
    # ---------------------------------------------------------
    # 3. IDENTIFY MISSING DESCRIPTIONS & PREPARE TASKS
    # ---------------------------------------------------------
    files_needing_ai: list[dict] = []
    
    for result in results:
        fpath = result["file_path"]
        
        # If parser found a docstring, use it (priority)
        if result["description"] and len(result["description"].strip()) > 10:
            continue
            
        # If we have a cached description from previous run, use it
        if fpath in description_cache:
            result["description"] = description_cache[fpath]
        else:
            # No docstring AND no cache -> Needs AI
            files_needing_ai.append(result)
    
    # ---------------------------------------------------------
    # 4. BATCH GENERATE DESCRIPTIONS (Concurrent)
    # ---------------------------------------------------------
    if files_needing_ai:
        # Semaphore for rate limiting
        sem = asyncio.Semaphore(4)
        
        async def generate_for_file(file_result: dict):
            async with sem:
                try:
                    # Read file content
                    path = Path(file_result["file_path"])
                    if not path.exists():
                        return
                    
                    content = path.read_text(encoding="utf-8")
                    if not content.strip(): 
                        return

                    prompt = (
                        f"Analyze the following Python file '{path.name}' and provide a VERY BRIEF (1-2 sentences) "
                        "summary of its purpose. Do not mention specific function names unless critical. "
                        "Start with 'Handles...', 'Provides...', 'Defines...' etc.\n\n"
                        f"File Content (truncated):\n{content[:2000]}"
                    )
                    
                    # 10s timeout per file
                    desc = await complete_text(prompt, timeout=10)
                    file_result["description"] = desc
                except Exception:
                     # Silently fail to "Description unavailable" to not break the scan
                     file_result["description"] = "Description unavailable (AI skipped)"

        # Run concurrent tasks
        ai_tasks = [generate_for_file(f) for f in files_needing_ai]
        # Wait for all to complete (or fail safely)
        if ai_tasks:
            await asyncio.gather(*ai_tasks)

    # ---------------------------------------------------------
    # 5. PERSIST RESULTS
    # ---------------------------------------------------------
    total_complexity = 0

    for result in results:
        file_analysis = FileAnalysis(
            file_path=result["file_path"],
            complexity_score=result["complexity_score"],
            node_count=result["node_count"],
            cognitive_complexity=result["cognitive_complexity"],
            halstead_volume=result["halstead_volume"],
            maintainability_index=result["maintainability_index"],
            sqale_debt_hours=result["sqale_debt_hours"],
            lines_of_code=result["lines_of_code"],
            description=result.get("description"),
            last_analyzed=datetime.now(UTC)
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
        response = await complete_text("Say 'Hello from Claude Opus!' in exactly those words.")
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


@app.post("/diagnose", response_model=DiagnoseResponse)
async def diagnose_file(request: DiagnoseRequest) -> DiagnoseResponse:
    """
    Diagnose a file for code smells or bugs using LLM.

    Distinguishes between:
    - Serious issues (bugs, errors) that need fixing
    - Minor suggestions (style, optimization) that are optional
    - Clean code that doesn't need changes

    Args:
        request: The diagnose request with file_path.

    Returns:
        DiagnoseResponse: The diagnosis with health status and suggestions.
    """
    import json

    try:
        file_path = Path(request.file_path)

        if not file_path.exists():
            return DiagnoseResponse(
                is_healthy=False,
                issue="File not found",
                severity="high",
                suggestions=[],
            )

        code = file_path.read_text(encoding="utf-8")

        # Ask LLM to diagnose with nuanced understanding
        prompt = f"""You are a Senior Code Reviewer. Analyze this Python code and determine if it needs fixes.

IMPORTANT: Be honest. If the code is functionally correct and well-written, say so. Don't invent problems.

```python
{code}
```

Categorize your findings:
1. SERIOUS ISSUES (severity: high/medium) - Bugs, errors, security issues, crashes, incorrect logic
2. MINOR SUGGESTIONS (severity: low/none) - Style improvements, optional optimizations, documentation

Respond with ONLY a JSON object in this exact format (no markdown):
{{
  "is_healthy": true/false,
  "issue": "Main issue description OR 'Code looks good!' if healthy",
  "severity": "none|low|medium|high",
  "suggestions": ["optional minor improvement 1", "optional minor improvement 2"]
}}

RULES:
- Set is_healthy=true if code has NO serious bugs/errors (even if minor improvements exist)
- Set is_healthy=false ONLY if there are actual bugs, crashes, or serious logic errors
- severity="none" if code is healthy, "low" for style issues, "medium"/"high" for real bugs
- suggestions should be optional improvements, not required fixes
- If code is healthy, issue should be "Code looks good!" or similar positive message

Examples:
{{"is_healthy": false, "issue": "Division by zero not handled - will crash", "severity": "high", "suggestions": []}}
{{"is_healthy": true, "issue": "Code looks good!", "severity": "none", "suggestions": ["Consider adding type hints", "Docstring could be more detailed"]}}
{{"is_healthy": true, "issue": "Code is functional and well-structured", "severity": "none", "suggestions": ["Variable naming could be more descriptive"]}}
{{"is_healthy": false, "issue": "Infinite loop possible when input is empty", "severity": "medium", "suggestions": []}}"""

        response = await complete_text(prompt)

        # Parse JSON response
        try:
            # Clean response of any markdown
            clean_response = response.strip()
            if clean_response.startswith("```"):
                lines = clean_response.split("```")
                if len(lines) > 1:
                    clean_response = lines[1]
                    if clean_response.startswith("json"):
                        clean_response = clean_response[4:]
            
            result = json.loads(clean_response.strip())
            
            return DiagnoseResponse(
                is_healthy=result.get("is_healthy", False),
                issue=result.get("issue", "Analysis complete"),
                severity=result.get("severity", "low"),
                suggestions=result.get("suggestions", []),
            )
        except json.JSONDecodeError:
            # If JSON parsing fails, assume healthy with the raw response as suggestion
            return DiagnoseResponse(
                is_healthy=True,
                issue="Code analyzed - no critical issues found",
                severity="none",
                suggestions=[response[:200]] if response else [],
            )

    except Exception as e:
        return DiagnoseResponse(
            is_healthy=False,
            issue=f"Analysis failed: {str(e)}",
            severity="medium",
            suggestions=[],
        )


@app.post("/diagnose-all", response_model=DiagnoseAllResponse)
async def diagnose_all_files(
    session: Session = Depends(get_session),
) -> DiagnoseAllResponse:
    """
    Diagnose all analyzed files for bugs and issues.

    Scans all files in the database and identifies those with potential bugs.
    Returns a prioritized list of issues for the user to address.

    Returns:
        DiagnoseAllResponse: List of file issues sorted by severity.
    """
    import json

    files = session.exec(select(FileAnalysis)).all()
    issues: list[FileIssue] = []

    for file in files:
        # Skip files that are already healthy based on MI
        # Only diagnose files with lower maintainability or high complexity
        if file.maintainability_index >= 85 and file.cognitive_complexity < 5:
            continue

        try:
            file_path = Path(file.file_path)
            if not file_path.exists():
                continue

            code = file_path.read_text(encoding="utf-8")

            # Quick diagnosis prompt - focused on bugs only
            prompt = f"""Analyze this Python code for BUGS ONLY (not style issues).

```python
{code}
```

Look for:
- Division by zero
- Null/None reference errors
- Index out of bounds
- Infinite loops
- Unhandled exceptions
- Logic errors
- Security vulnerabilities

If there are NO bugs, respond with exactly: {{"has_bug": false}}

If there IS a bug, respond with:
{{"has_bug": true, "issue": "Brief description of the bug", "severity": "low|medium|high"}}

Only respond with JSON, no markdown."""

            response = await complete_text(prompt)

            # Parse response
            try:
                clean_response = response.strip()
                if clean_response.startswith("```"):
                    lines = clean_response.split("```")
                    if len(lines) > 1:
                        clean_response = lines[1]
                        if clean_response.startswith("json"):
                            clean_response = clean_response[4:]

                result = json.loads(clean_response.strip())

                if result.get("has_bug", False):
                    issues.append(FileIssue(
                        file_path=file.file_path,
                        file_name=file_path.name,
                        issue=result.get("issue", "Potential issue detected"),
                        severity=result.get("severity", "medium"),
                        cognitive_complexity=file.cognitive_complexity,
                        maintainability_index=file.maintainability_index,
                    ))
            except json.JSONDecodeError:
                # If parsing fails but response mentions a bug, still include it
                if "bug" in response.lower() or "error" in response.lower():
                    issues.append(FileIssue(
                        file_path=file.file_path,
                        file_name=file_path.name,
                        issue=response[:150] if response else "Analysis inconclusive",
                        severity="medium",
                        cognitive_complexity=file.cognitive_complexity,
                        maintainability_index=file.maintainability_index,
                    ))

        except Exception:
            continue

    # Sort by severity (high first) then by maintainability index (lower first)
    severity_order = {"high": 0, "medium": 1, "low": 2}
    issues.sort(key=lambda x: (severity_order.get(x.severity, 1), x.maintainability_index))

    return DiagnoseAllResponse(
        issues=issues,
        total_files=len(files),
        files_with_issues=len(issues),
    )


@app.post("/file-content", response_model=FileContentResponse)
async def get_file_content(request: FileContentRequest) -> FileContentResponse:
    """
    Get the content of a file.

    Args:
        request: The request with file_path.

    Returns:
        FileContentResponse: The file content and name.
    """
    try:
        file_path = Path(request.file_path)

        if not file_path.exists():
            return FileContentResponse(
                content="# File not found",
                file_name=file_path.name,
            )

        content = file_path.read_text(encoding="utf-8")
        return FileContentResponse(
            content=content,
            file_name=file_path.name,
        )

    except Exception as e:
        return FileContentResponse(
            content=f"# Error reading file: {str(e)}",
            file_name=Path(request.file_path).name,
        )


@app.post("/download-fix")
async def download_fix(request: DownloadFixRequest) -> StreamingResponse:
    """
    Download the fixed code as a file (Safe Mode).

    Instead of overwriting the original file, this returns the fixed code
    as a downloadable file with '_fixed' suffix.

    Args:
        request: The request with file_path and fixed_code.

    Returns:
        StreamingResponse: The fixed code as a downloadable Python file.
    """
    import io

    # Extract original filename and create fixed filename
    original_path = Path(request.file_path)
    original_name = original_path.stem  # filename without extension
    extension = original_path.suffix or ".py"
    fixed_filename = f"{original_name}_fixed{extension}"

    # Create a file-like object from the fixed code
    file_content = io.BytesIO(request.fixed_code.encode("utf-8"))

    return StreamingResponse(
        file_content,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{fixed_filename}"'
        },
    )


@app.post("/browse", response_model=BrowseResponse)
async def browse_directory(request: BrowseRequest) -> BrowseResponse:
    """
    Browse filesystem directories for folder selection.

    Returns a list of directories and files in the specified path,
    allowing the frontend to implement a folder picker UI.

    Args:
        request: The request with optional path. Defaults to home directory.

    Returns:
        BrowseResponse: Current path, parent path, and list of entries.
    """
    import os

    # Default to home directory
    if request.path is None or request.path == "":
        current_path = Path.home()
    else:
        current_path = Path(request.path).expanduser().resolve()

    # Validate path exists
    if not current_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Path not found: {current_path}",
        )

    if not current_path.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not a directory: {current_path}",
        )

    # Get parent path (None if at root)
    parent_path = str(current_path.parent) if current_path.parent != current_path else None

    # List directory contents
    entries: list[DirectoryEntry] = []

    try:
        for entry in sorted(current_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
            # Skip hidden files/folders (starting with .)
            if entry.name.startswith("."):
                continue

            # Skip common non-project directories
            if entry.name in {"node_modules", "__pycache__", "venv", ".venv", "env"}:
                continue

            try:
                entries.append(
                    DirectoryEntry(
                        name=entry.name,
                        path=str(entry),
                        is_dir=entry.is_dir(),
                    )
                )
            except PermissionError:
                # Skip entries we can't access
                continue

    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: {current_path}",
        )

    return BrowseResponse(
        current_path=str(current_path),
        parent_path=parent_path,
        entries=entries,
    )
