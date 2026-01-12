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
      <header className="sticky top-0 z-50 glass-header px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">
              RepoView
            </h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Technical Debt Manager
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Backend Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800/40 border border-slate-700/50 text-sm">
            <div className={`w-2 h-2 rounded-full ${health?.status === "ok" ? "bg-emerald-400" : "bg-red-500"}`} />
            <span className="text-slate-400 font-medium">
              {health?.status === "ok" ? "Online" : "Offline"}
            </span>
          </div>

          <div className="h-6 w-px bg-slate-700/50" />

          {/* Action Buttons - Bigger */}
          <button
            onClick={runDiagnosis}
            disabled={isDiagnosing || files.length === 0}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-smooth
              ${isDiagnosing || files.length === 0
                ? "text-slate-600 cursor-not-allowed"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/15 hover:border-amber-500/30"
              }
            `}
          >
            {isDiagnosing ? (
              <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            <span>Diagnose</span>
          </button>

          <button
            onClick={handleNativeScan}
            disabled={!health || isScanning}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-smooth
              ${!health || isScanning
                ? "bg-slate-800/50 text-slate-600 cursor-not-allowed"
                : "bg-cyan-500 text-white hover:bg-cyan-400 shadow-sm shadow-cyan-500/20"
              }
            `}
          >
            {isScanning ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Scanning</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
                <span>Scan Project</span>
              </>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto p-6 space-y-6">

        {/* Project Context & Stats Toast */}
        {(currentProject || lastScan || error) && (
          <div className="grid grid-cols-1 gap-3 animate-fade-in-up">
            {currentProject && (
              <div className="glass-panel p-3 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-cyan-500/10 border border-cyan-500/20 rounded flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Workspace</p>
                    <p className="text-xs font-mono text-slate-300">{currentProject}</p>
                  </div>
                </div>
                <button onClick={() => setShowScanModal(true)} className="text-[10px] text-slate-500 hover:text-cyan-400 transition-smooth font-medium uppercase tracking-wider">Change</button>
              </div>
            )}

            {lastScan && (
              <div className="glass-panel p-3 rounded-lg border-l-2 border-l-emerald-500 flex items-center justify-between bg-emerald-500/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-xs text-emerald-300">
                    Analyzed <span className="font-semibold text-white">{lastScan.files}</span> files
                    <span className="text-emerald-400/60 mx-1.5">·</span>
                    Complexity: <span className="font-mono">{lastScan.complexity}</span>
                  </span>
                </div>
                <button onClick={() => setLastScan(null)} className="text-xs text-emerald-400/60 hover:text-white transition-smooth">✕</button>
              </div>
            )}

            {error && !health && (
              <div className="glass-panel p-3 rounded-lg border-l-2 border-l-red-500 bg-red-500/5 text-red-200 text-xs flex items-center gap-2.5">
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
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
