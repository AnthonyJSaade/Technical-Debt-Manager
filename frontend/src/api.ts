/**
 * RepoVision API Client
 *
 * Provides typed fetch wrappers for the backend API.
 */

const API_BASE = "http://localhost:8000";

// ============================================================================
// Types
// ============================================================================

export interface HealthStatus {
  status: string;
}

export interface FileAnalysis {
  id: number;
  file_path: string;
  complexity_score: number;
  node_count: number;
  cognitive_complexity: number;
  halstead_volume: number;
  maintainability_index: number;
  sqale_debt_hours: number;
  lines_of_code: number;
  description: string | null;  // Module-level docstring
  last_analyzed: string;
}

export interface ScanResult {
  files_scanned: number;
  total_complexity: number;
}

export interface FixResult {
  status: "success" | "failed";
  reason?: string;
  fixed_code?: string;
  repro_script?: string;
  attempts?: number;
}

export interface ApplyResult {
  success: boolean;
  message: string;
}

export interface DiagnoseResult {
  is_healthy: boolean;
  issue: string;
  severity: "none" | "low" | "medium" | "high";
  suggestions: string[];
}

export interface FileContentResult {
  content: string;
  file_name: string;
}

export interface FileIssue {
  file_path: string;
  file_name: string;
  issue: string;
  severity: "low" | "medium" | "high";
  cognitive_complexity: number;
  maintainability_index: number;
}

export interface DiagnoseAllResult {
  issues: FileIssue[];
  total_files: number;
  files_with_issues: number;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export interface BrowseResult {
  current_path: string;
  parent_path: string | null;
  entries: DirectoryEntry[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Check backend health status.
 */
export async function getHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Get all analyzed files sorted by complexity (descending).
 */
export async function getFiles(): Promise<FileAnalysis[]> {
  const response = await fetch(`${API_BASE}/files`);
  if (!response.ok) {
    throw new Error(`Failed to fetch files: ${response.status}`);
  }
  return response.json();
}

/**
 * Trigger a project scan.
 *
 * @param path - Optional directory path to scan. Defaults to backend directory.
 */
export async function scanProject(path?: string): Promise<ScanResult> {
  const response = await fetch(`${API_BASE}/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: path ?? null }),
  });
  if (!response.ok) {
    throw new Error(`Scan failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Request the Janitor Agent to fix a bug in a file.
 *
 * @param filePath - Path to the file to fix.
 * @param instruction - Description of the bug to fix.
 */
export async function fixFile(
  filePath: string,
  instruction: string
): Promise<FixResult> {
  const response = await fetch(`${API_BASE}/fix`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file_path: filePath, instruction }),
  });
  if (!response.ok) {
    throw new Error(`Fix failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Apply a fix by overwriting the file on disk.
 *
 * @param filePath - Path to the file to overwrite.
 * @param newCode - The new code to write.
 */
export async function applyFix(
  filePath: string,
  newCode: string
): Promise<ApplyResult> {
  const response = await fetch(`${API_BASE}/apply-fix`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file_path: filePath, new_code: newCode }),
  });
  if (!response.ok) {
    throw new Error(`Apply fix failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Diagnose a file for code smells or bugs.
 *
 * @param filePath - Path to the file to diagnose.
 */
export async function diagnoseFile(filePath: string): Promise<DiagnoseResult> {
  const response = await fetch(`${API_BASE}/diagnose`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file_path: filePath }),
  });
  if (!response.ok) {
    throw new Error(`Diagnose failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Get the content of a file.
 *
 * @param filePath - Path to the file to read.
 */
export async function getFileContent(filePath: string): Promise<FileContentResult> {
  const response = await fetch(`${API_BASE}/file-content`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file_path: filePath }),
  });
  if (!response.ok) {
    throw new Error(`Get file content failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Download the fixed code as a file (Safe Mode).
 * Triggers a browser download instead of overwriting the original file.
 *
 * @param filePath - Original file path (used to generate filename).
 * @param fixedCode - The fixed code to download.
 */
export async function downloadFix(filePath: string, fixedCode: string): Promise<void> {
  const response = await fetch(`${API_BASE}/download-fix`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file_path: filePath, fixed_code: fixedCode }),
  });

  if (!response.ok) {
    throw new Error(`Download fix failed: ${response.status}`);
  }

  // Get the blob from response
  const blob = await response.blob();

  // Extract filename from Content-Disposition header or generate one
  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = "fixed_code.py";
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="(.+)"/);
    if (match) {
      filename = match[1];
    }
  }

  // Create a download link and trigger it
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Diagnose all files in the database for bugs.
 * Returns a list of files with detected issues.
 */
export async function diagnoseAllFiles(): Promise<DiagnoseAllResult> {
  const response = await fetch(`${API_BASE}/diagnose-all`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Diagnose all failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Browse filesystem directories.
 * Returns directory contents for folder picker UI.
 */
export async function browseDirectory(path?: string): Promise<BrowseResult> {
  const response = await fetch(`${API_BASE}/browse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: path ?? null }),
  });
  if (!response.ok) {
    throw new Error(`Browse failed: ${response.status}`);
  }
  return response.json();
}

