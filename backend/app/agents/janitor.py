"""
The Janitor Agent - TDD-based bug fixer.

Implements a Probe -> Fix -> Verify loop using LLM and Docker sandbox.
"""

import os
from pathlib import Path

from anthropic import AsyncAnthropic

from app.agents.sandbox import DockerSandbox

# ============================================================================
# System Prompts
# ============================================================================

SYSTEM_PROMPT = """You are a Senior Python Maintenance Engineer. Your goal is to fix bugs in legacy code.

Rules:
1. Minimal Changes: Only touch lines relevant to the bug. Do not rewrite the whole file style.
2. Preserve Logic: Do not delete features to make tests pass.
3. Format: Output only the raw Python code for the fixed file, no markdown.
"""

REPRO_PROMPT = """You are a Senior Python QA Engineer. Your goal is to write a test that verifies a bug fix.

Rules:
1. The script will be appended AFTER the module code, so functions are already available
2. DO NOT import the module - just call the functions directly
3. The script must EXIT WITH CODE 1 (fail) when the BUG EXISTS
4. The script must EXIT WITH CODE 0 (pass) when the BUG IS FIXED
5. Use try/except and sys.exit() to control the exit code
6. Output only the raw Python code, no markdown, no imports of the module itself

Example for a "division by zero" bug that should return 0 instead of crashing:
```
import sys
try:
    result = divide(10, 0)  # Should return 0, not crash
    if result == 0:
        sys.exit(0)  # PASS - bug is fixed
    else:
        sys.exit(1)  # FAIL - wrong result
except ZeroDivisionError:
    sys.exit(1)  # FAIL - bug still exists (crashes on division by zero)
```
"""

CLASSIFY_PROMPT = """You are a code issue classifier. Classify the following issue into exactly ONE category.

Categories:
- behavioral_bug: Logic errors, crashes, incorrect output, runtime exceptions, security issues
- typo: Spelling mistakes in variable names, strings, comments, or identifiers
- docs: Documentation changes, docstring updates, README edits
- style: Formatting, naming conventions, code style improvements, refactoring

Respond with ONLY the category name, nothing else."""


class JanitorAgent:
    """
    TDD-based bug fixing agent.

    Uses a state machine approach:
    1. Read the buggy code
    2. Generate reproduction script (must fail)
    3. Generate fix (retry up to 3 times)
    4. Verify fix passes reproduction script
    """

    MAX_RETRIES = 3
    SIMPLE_ISSUE_TYPES = {"typo", "docs", "style"}  # Issues that skip TDD verification

    def __init__(self, sandbox: DockerSandbox) -> None:
        """
        Initialize the Janitor Agent.

        Args:
            sandbox: Docker sandbox for safe code execution.
        """
        self.sandbox = sandbox
        self.llm = AsyncAnthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY"),
        )
        self.model = "claude-opus-4-5"

    async def _classify_issue(self, bug_desc: str) -> str:
        """
        Classify the issue type using LLM.

        Args:
            bug_desc: Description of the issue to classify.

        Returns:
            Issue type: 'behavioral_bug', 'typo', 'docs', or 'style'.
        """
        response = await self._ask_llm(
            CLASSIFY_PROMPT, f"Issue to classify: {bug_desc}"
        )
        # Normalize response
        issue_type = response.strip().lower().replace(" ", "_")

        # Validate - default to behavioral_bug for unknown types
        valid_types = {"behavioral_bug", "typo", "docs", "style"}
        if issue_type not in valid_types:
            return "behavioral_bug"
        return issue_type

    async def _ask_llm(self, system_prompt: str, user_prompt: str) -> str:
        """
        Send a prompt to the LLM and get a response.

        Args:
            system_prompt: The system context.
            user_prompt: The user message.

        Returns:
            The LLM's response text.
        """
        response = await self.llm.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system_prompt,  # Anthropic uses 'system' parameter
            messages=[
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,  # Lower temperature for more deterministic fixes
        )
        # Anthropic returns response.content as a list of content blocks
        return response.content[0].text if response.content else ""

    def _clean_code_response(self, response: str) -> str:
        """
        Clean LLM response to extract pure Python code.

        Removes markdown code blocks if present.

        Args:
            response: Raw LLM response.

        Returns:
            Clean Python code.
        """
        code = response.strip()

        # Remove markdown code blocks
        if code.startswith("```python"):
            code = code[9:]
        elif code.startswith("```"):
            code = code[3:]

        if code.endswith("```"):
            code = code[:-3]

        return code.strip()

    def _run_in_sandbox(self, main_code: str, test_code: str) -> tuple[bool, str]:
        """
        Run test code against main code in the sandbox.

        Creates a combined script that includes the main code as a module
        and runs the test code.

        Args:
            main_code: The Python code being tested.
            test_code: The test/reproduction script.

        Returns:
            Tuple of (passed: bool, output: str)
        """
        # Create a combined script that defines the module and runs tests
        combined = f"""
# === MODULE CODE ===
{main_code}

# === TEST CODE ===
{test_code}
"""
        output = self.sandbox.run_code(combined)

        # Check if it passed (no error indicators)
        passed = (
            not output.startswith("Error:")
            and "Traceback" not in output
            and "AssertionError" not in output
        )

        return passed, output

    async def solve(self, file_path: str, bug_desc: str) -> dict:
        """
        Attempt to fix a bug using dynamic retry logic.

        For behavioral bugs: Uses TDD loop with reproduction script.
        For simple issues (typo/docs/style): Direct fix without verification.

        Args:
            file_path: Path to the buggy Python file.
            bug_desc: Description of the bug to fix.

        Returns:
            dict with keys:
                - status: "success" | "failed"
                - reason: Error reason (if failed)
                - fixed_code: The fixed code (if success)
                - issue_type: Classified issue type
                - repro_script: The reproduction script used (TDD only)
        """
        # === Step 0: Classify the issue ===
        issue_type = await self._classify_issue(bug_desc)
        is_simple_issue = issue_type in self.SIMPLE_ISSUE_TYPES

        # === Step A: Read the code ===
        try:
            path = Path(file_path)
            if not path.exists():
                return {
                    "status": "failed",
                    "reason": f"File not found: {file_path}",
                    "issue_type": issue_type,
                }
            original_code = path.read_text(encoding="utf-8")
        except Exception as e:
            return {
                "status": "failed",
                "reason": f"Could not read file: {e}",
                "issue_type": issue_type,
            }

        # === SIMPLE ISSUE PATH (typo/docs/style) ===
        if is_simple_issue:
            # Direct fix without TDD verification
            simple_fix_prompt = f"""Fix this Python code:

```python
{original_code}
```

Issue: {bug_desc}
Issue type: {issue_type}

Provide the COMPLETE fixed file. Only change what's necessary.
Output only Python code, no markdown."""

            fixed_code = await self._ask_llm(SYSTEM_PROMPT, simple_fix_prompt)
            fixed_code = self._clean_code_response(fixed_code)

            return {
                "status": "success",
                "fixed_code": fixed_code,
                "issue_type": issue_type,
                "attempts": 1,
                "verification": "skipped (simple issue)",
            }

        # === BEHAVIORAL BUG PATH (TDD loop) ===
        # Check sandbox availability for TDD
        if not self.sandbox.available:
            return {
                "status": "failed",
                "reason": "Docker sandbox is not available (required for behavioral bug verification)",
                "issue_type": issue_type,
            }

        # === Step B: Generate reproduction script ===
        repro_prompt = f"""Given this Python code with a bug:

```python
{original_code}
```

Bug description: {bug_desc}

Write a TEST SCRIPT that:
1. Calls the functions directly (they are already defined, DO NOT import them)
2. Uses sys.exit(1) when the BUG EXISTS (test fails)
3. Uses sys.exit(0) when the BUG IS FIXED (test passes)
4. Wraps risky calls in try/except to catch crashes

The script will be appended after the module code. Output only Python code, no markdown."""

        repro_script = await self._ask_llm(REPRO_PROMPT, repro_prompt)
        repro_script = self._clean_code_response(repro_script)

        # Validate: Reproduction must FAIL on buggy code
        passed, output = self._run_in_sandbox(original_code, repro_script)

        if passed:
            return {
                "status": "failed",
                "reason": "Could not reproduce bug - test passes on original code",
                "repro_script": repro_script,
                "test_output": output,
                "issue_type": issue_type,
            }

        # === Step C: Fix Loop ===
        current_code = original_code
        last_error = output

        for attempt in range(1, self.MAX_RETRIES + 1):
            # Ask LLM to fix the code
            fix_prompt = f"""Fix this buggy Python code:

```python
{current_code}
```

Bug description: {bug_desc}

The reproduction script produces this error:
```
{last_error}
```

Provide the COMPLETE fixed file. Only change what's necessary to fix the bug.
Output only Python code, no markdown."""

            fixed_code = await self._ask_llm(SYSTEM_PROMPT, fix_prompt)
            fixed_code = self._clean_code_response(fixed_code)

            # Test the fix
            passed, output = self._run_in_sandbox(fixed_code, repro_script)

            if passed:
                # Success!
                return {
                    "status": "success",
                    "fixed_code": fixed_code,
                    "repro_script": repro_script,
                    "attempts": attempt,
                    "issue_type": issue_type,
                }

            # Failed, prepare for next attempt
            last_error = output
            current_code = fixed_code  # Let LLM iterate on its own fix

        # === Step D: All retries exhausted ===
        return {
            "status": "failed",
            "reason": f"Could not fix after {self.MAX_RETRIES} attempts",
            "last_error": last_error,
            "repro_script": repro_script,
            "last_attempt": current_code,
            "issue_type": issue_type,
        }
