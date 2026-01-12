import { useCallback, useEffect, useState } from "react";
import { getHealth, getFiles, scanProject, diagnoseAllFiles, selectDirectory } from "./api";
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
  // ... state ...
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<{ files: number; complexity: number } | null>(null);
  // Consolidate file selection state
  const [activeFile, setActiveFile] = useState<FileAnalysis | null>(null);
  const [showJanitor, setShowJanitor] = useState(false);

  const [issues, setIssues] = useState<FileIssue[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [hasDiagnosed, setHasDiagnosed] = useState(false); // Track if diagnosis has been run
  const [showScanModal, setShowScanModal] = useState(false);
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false); // Prevent double popup

  // ... fetch handlers ...
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

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const handleScan = async (path: string) => {
    setIsScanning(true);
    setLastScan(null);
    setFiles([]);
    setIssues([]);
    setIsLoading(true);
    try {
      const result = await scanProject(path);
      setLastScan({ files: result.files_scanned, complexity: result.total_complexity });
      setCurrentProject(path);
      setShowScanModal(false);
      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  const handleNativeScan = async () => {
    // Prevent double popups
    if (isPickerOpen || isScanning) return;

    setIsPickerOpen(true);
    try {
      // Trigger native picker on backend
      const path = await selectDirectory();
      if (path) {
        // If user selected a path, start scanning immediately
        await handleScan(path);
      }
    } catch (err) {
      console.error("Native scan failed:", err);
      // Fallback: show custom modal if native fails (optional, but good for safety)
      setShowScanModal(true);
    } finally {
      setIsPickerOpen(false);
    }
  };

  // Unified handler for Map and Issue clicks
  // Always opens the SpecSheet (by setting activeFile)
  const handleFileAction = (fileOrPath: FileAnalysis | string) => {
    let file: FileAnalysis | undefined;

    if (typeof fileOrPath === 'string') {
      file = files.find(f => f.file_path === fileOrPath);
    } else {
      file = fileOrPath;
    }

    if (file) {
      setActiveFile(file);
      setShowJanitor(false); // Reset Janitor state
    }
  };

  const handleInitiateMaintenance = () => {
    setShowJanitor(true);
  };

  const handleCloseViewer = () => {
    setActiveFile(null);
    setShowJanitor(false);
  };

  const handleFixApplied = () => {
    fetchFiles();
  };

  const runDiagnosis = useCallback(async () => {
    if (files.length === 0) return;
    setIsDiagnosing(true);
    try {
      const result = await diagnoseAllFiles();
      setIssues(result.issues);
      setHasDiagnosed(true); // Mark that diagnosis has been run
    } catch (err) {
      console.error("Failed to diagnose files:", err);
    } finally {
      setIsDiagnosing(false);
    }
  }, [files.length]);

  return (
    <div className="min-h-screen font-sans text-slate-200">

      {/* Sticky Glass Header */}
      <header className="sticky top-0 z-50 glass-header px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-cyan-500 to-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <span className="text-xl">⚡</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              RepoVision
            </h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">
              Technical Debt Intelligence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Backend Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs">
            <div className={`w-1.5 h-1.5 rounded-full ${health?.status === "ok" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-red-500"}`} />
            <span className="text-slate-400 font-medium">
              {health?.status === "ok" ? "System Online" : "Disconnected"}
            </span>
          </div>

          <div className="h-6 w-px bg-white/10 mx-2" />

          {/* Action Buttons */}
          <button
            onClick={runDiagnosis}
            disabled={isDiagnosing || files.length === 0}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
              ${isDiagnosing || files.length === 0
                ? "text-slate-500 cursor-not-allowed"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_0_15px_rgba(245,158,11,0.1)]"
              }
            `}
          >
            {isDiagnosing ? <span className="animate-spin">⟳</span> : "🔍"}
            <span>Diagnose Issues</span>
          </button>

          <button
            onClick={handleNativeScan}
            disabled={!health || isScanning}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
              ${!health || isScanning
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-cyan-600 to-indigo-600 text-white hover:from-cyan-500 hover:to-indigo-500 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 border border-transparent"
              }
            `}
          >
            {isScanning ? (
              <>
                <span className="animate-spin">⟳</span> Scanning...
              </>
            ) : (
              <>📂 Scan Project</>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-8 space-y-8">

        {/* Project Context & Stats Toast */}
        {(currentProject || lastScan || error) && (
          <div className="grid grid-cols-1 gap-4 animate-fade-in-up">
            {currentProject && (
              <div className="glass-panel p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">📁</div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Current Workspace</p>
                    <p className="text-sm font-mono text-cyan-300">{currentProject}</p>
                  </div>
                </div>
                <button onClick={() => setShowScanModal(true)} className="text-xs text-slate-400 hover:text-white transition-colors">Change</button>
              </div>
            )}

            {lastScan && (
              <div className="glass-panel p-4 rounded-xl border-l-4 border-l-emerald-500 flex items-center justify-between bg-emerald-950/20">
                <div className="flex items-center gap-3">
                  <div className="text-emerald-400">✓</div>
                  <span className="text-sm text-emerald-200">
                    Successfully analyzed <span className="font-bold text-white">{lastScan.files}</span> files.
                    Total Complexity: <span className="font-mono">{lastScan.complexity}</span>.
                  </span>
                </div>
                <button onClick={() => setLastScan(null)} className="text-emerald-400 hover:text-white">×</button>
              </div>
            )}

            {error && !health && (
              <div className="glass-panel p-4 rounded-xl border-l-4 border-l-red-500 bg-red-950/20 text-red-200 text-sm flex items-center gap-3">
                <span className="text-xl">⚠</span> {error}
              </div>
            )}
          </div>
        )}

        {/* Top Row: Metrics and Issues */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>

          {/* Health Metrics */}
          <section className="h-full">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Health Metrics
            </h2>
            <div className="h-full">
              <HealthHUD files={files} isLoading={isLoading} />
            </div>
          </section>

          {/* Active Issues (Always visible now, with empty state handling outside) */}
          <section className="h-full">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Active Issues
            </h2>
            <div className="h-full">
              <IssuesPanel
                issues={issues}
                isLoading={isDiagnosing}
                onIssueClick={handleFileAction}
                files={files}
                hasDiagnosed={hasDiagnosed}
              />
            </div>
          </section>
        </div>

        {/* Bottom Row: Full Width Architecture Map */}
        <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <section className="h-full flex flex-col">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Active Architecture
            </h2>
            <div className="w-full">
              <CodeMap
                files={files}
                issues={issues}
                selectedFile={activeFile}
                onFileClick={handleFileAction}
              />
            </div>
          </section>
        </div>

        <footer className="pt-12 pb-8 text-center border-t border-white/5">
          <p className="text-sm text-slate-500 font-light">
            RepoVision AI • <span className="text-slate-600">v0.9.1 Beta</span>
          </p>
        </footer>

      </main>

      {/* Modals */}

      {/* 1. Spec Sheet: The Unified Info Modal */}
      {activeFile && !showJanitor && (
        <SpecSheet
          file={activeFile}
          onClose={handleCloseViewer}
          onInitiateMaintenance={handleInitiateMaintenance}
        />
      )}

      {/* 2. Janitor Agent: The Action Modal (Overlays Spec Sheet concept) */}
      {activeFile && showJanitor && (
        <FixModal
          selectedFile={activeFile}
          onClose={() => setShowJanitor(false)} // Back to Spec Sheet
          onApplied={handleFixApplied}
        />
      )}

      <ScanModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        onScan={handleScan}
        isScanning={isScanning}
      />
    </div>
  );

}

export default App;
