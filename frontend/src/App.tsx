import { useCallback, useEffect, useState } from "react";
import { getHealth, getFiles, scanProject, diagnoseAllFiles } from "./api";
import type { FileAnalysis, HealthStatus, FileIssue } from "./api";
import { HealthHUD } from "./components/HealthHUD";
import { CodeMap } from "./components/CodeMap";
import { FixModal } from "./components/FixModal";
import { IssuesPanel } from "./components/IssuesPanel";
import { ScanModal } from "./components/ScanModal";
import { SpecSheet } from "./components/SpecSheet";

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [files, setFiles] = useState<FileAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<{ files: number; complexity: number } | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileAnalysis | null>(null);
  const [issues, setIssues] = useState<FileIssue[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [specSheetFile, setSpecSheetFile] = useState<FileAnalysis | null>(null);

  // Fetch health status
  const fetchHealth = useCallback(async () => {
    try {
      const data = await getHealth();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to backend");
      setHealth(null);
    }
  }, []);

  // Fetch files list
  const fetchFiles = useCallback(async () => {
    try {
      const data = await getFiles();
      setFiles(data);
    } catch (err) {
      console.error("Failed to fetch files:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchHealth();
    fetchFiles();

    // Poll health every 10 seconds
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [fetchHealth, fetchFiles]);

  // Handle scan with path
  const handleScan = async (path: string) => {
    setIsScanning(true);
    setLastScan(null);
    // Immediately clear all previous data for a fresh start
    setFiles([]);
    setIssues([]);
    setIsLoading(true);
    try {
      const result = await scanProject(path);
      setLastScan({ files: result.files_scanned, complexity: result.total_complexity });
      setCurrentProject(path);
      setShowScanModal(false);
      // Refresh file list after scan
      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  // Handle file click from CodeMap - show SpecSheet first
  const handleFileClick = (file: FileAnalysis) => {
    setSelectedFile(file);
  };

  // Handle "Initiate Maintenance" from SpecSheet
  const handleInitiateMaintenance = () => {
    if (specSheetFile) {
      setSelectedFile(specSheetFile);
      setSpecSheetFile(null);
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setSelectedFile(null);
  };

  // Handle fix applied
  const handleFixApplied = () => {
    // Refresh file list after fix is applied
    fetchFiles();
  };

  // Diagnose all files for bugs
  const runDiagnosis = useCallback(async () => {
    if (files.length === 0) return;

    setIsDiagnosing(true);
    try {
      const result = await diagnoseAllFiles();
      setIssues(result.issues);
    } catch (err) {
      console.error("Failed to diagnose files:", err);
    } finally {
      setIsDiagnosing(false);
    }
  }, [files.length]);

  // Handle issue click - open SpecSheet for that file
  const handleIssueClick = (filePath: string) => {
    const file = files.find(f => f.file_path === filePath);
    if (file) {
      setSpecSheetFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--rv-bg-primary)] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              RepoVision
            </h1>
            <p className="text-[var(--rv-text-secondary)] text-sm mt-1">
              AI-Powered Mission Control for Technical Debt
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Backend Status */}
            <div className="flex items-center gap-2 text-sm">
              <div
                className={`w-2 h-2 rounded-full ${health?.status === "ok"
                  ? "bg-emerald-400 shadow-lg shadow-emerald-400/50"
                  : error
                    ? "bg-red-500"
                    : "bg-amber-400 animate-pulse"
                  }`}
              />
              <span className="text-gray-400">
                {health?.status === "ok" ? "Connected" : error ? "Disconnected" : "Connecting..."}
              </span>
            </div>

            {/* Find Bugs Button */}
            <button
              onClick={runDiagnosis}
              disabled={isDiagnosing || files.length === 0}
              className={`
                px-4 py-2.5 rounded-lg font-medium text-sm
                transition-all duration-200
                ${isDiagnosing || files.length === 0
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/25 hover:shadow-amber-500/40"
                }
              `}
            >
              {isDiagnosing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Finding Bugs...
                </span>
              ) : (
                <>🔍 Find Bugs</>
              )}
            </button>

            {/* Scan Button */}
            <button
              onClick={() => setShowScanModal(true)}
              disabled={!health}
              className={`
                px-5 py-2.5 rounded-lg font-medium text-sm
                transition-all duration-200
                ${!health
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 hover:shadow-emerald-500/40"
                }
              `}
            >
              📂 Scan Project
            </button>
          </div>
        </header>

        {/* Current Project Banner */}
        {currentProject && (
          <div className="mb-4 p-3 bg-cyan-900/20 border border-cyan-500/20 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-cyan-400">📁</span>
              <span className="text-gray-400">Analyzing:</span>
              <span className="text-cyan-300 font-mono truncate max-w-md">{currentProject}</span>
            </div>
            <button
              onClick={() => setShowScanModal(true)}
              className="text-xs text-cyan-400 hover:text-cyan-300 px-2 py-1 hover:bg-cyan-900/30 rounded transition-colors"
            >
              Change
            </button>
          </div>
        )}

        {/* Scan Result Toast */}
        {lastScan && (
          <div className="mb-6 p-4 bg-emerald-900/30 border border-emerald-500/30 rounded-lg flex items-center justify-between">
            <span className="text-emerald-400">
              ✓ Scanned {lastScan.files} files with total complexity of {lastScan.complexity}
            </span>
            <button
              onClick={() => setLastScan(null)}
              className="text-emerald-400 hover:text-emerald-300"
            >
              ×
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && !health && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400">
            ⚠ {error}
          </div>
        )}

        {/* Health HUD */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <span className="text-xl">📊</span> Health Dashboard
          </h2>
          <HealthHUD files={files} isLoading={isLoading} />
        </section>

        {/* Issues Panel - Shows detected bugs prominently */}
        {(issues.length > 0 || isDiagnosing) && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <span className="text-xl">🐛</span> Detected Issues
              {issues.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-500/20 text-red-300 rounded-full border border-red-500/30">
                  {issues.length} found
                </span>
              )}
            </h2>
            <IssuesPanel
              issues={issues}
              isLoading={isDiagnosing}
              onIssueClick={handleIssueClick}
              files={files}
            />
          </section>
        )}

        {/* Code Map - Blueprint Style */}
        <section>
          <h2 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <span className="text-xl">📐</span>
            <span className="font-mono uppercase tracking-wider">Architectural Blueprint</span>
            <span className="text-xs font-normal text-slate-500 ml-2 font-mono">
              Click component for specifications
            </span>
          </h2>
          <CodeMap files={files} issues={issues} onFileClick={handleFileClick} />
        </section>

        {/* Footer */}
        <footer className="mt-8 text-center text-gray-600 text-sm">
          RepoVision • AI-Powered Technical Debt Manager
        </footer>
      </div>

      {/* Fix Modal */}
      {selectedFile && (
        <FixModal
          selectedFile={selectedFile}
          onClose={handleModalClose}
          onApplied={handleFixApplied}
        />
      )}

      {/* Scan Modal */}
      <ScanModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        onScan={handleScan}
        isScanning={isScanning}
      />

      {/* Spec Sheet - Technical details before maintenance */}
      {specSheetFile && (
        <SpecSheet
          file={specSheetFile}
          onClose={() => setSpecSheetFile(null)}
          onInitiateMaintenance={handleInitiateMaintenance}
        />
      )}
    </div>
  );
}

export default App;
