/**
 * FixModal Component
 *
 * A proactive modal for the Janitor Agent bug fixing workflow.
 * Auto-diagnoses files and shows terminal-style loading animation.
 * Supports Safe Mode (download) and Live Mode (overwrite).
 */

import { useState, useEffect, useRef } from "react";
import { fixFile, applyFix, downloadFix, diagnoseFile, getFileContent } from "../api";
import type { FileAnalysis, FixResult, DiagnoseResult } from "../api";

interface FixModalProps {
  selectedFile: FileAnalysis;
  onClose: () => void;
  onApplied: () => void;
}

type ModalState = "diagnosing" | "input" | "loading" | "review" | "applying" | "success" | "error";
type FixMode = "safe" | "live";

interface LogEntry {
  text: string;
  type: "info" | "success" | "error" | "warning";
}

export function FixModal({ selectedFile, onClose, onApplied }: FixModalProps) {
  const [state, setState] = useState<ModalState>("diagnosing");
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState<FixResult | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnoseResult | null>(null);
  const [originalCode, setOriginalCode] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [fixMode, setFixMode] = useState<FixMode>("safe"); // Default to safe mode
  const logContainerRef = useRef<HTMLDivElement>(null);

  const fileName = selectedFile.file_path.split("/").pop() || selectedFile.file_path;

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Add log entry helper
  const addLog = (text: string, type: LogEntry["type"] = "info") => {
    setLogs(prev => [...prev, { text, type }]);
  };

  // Auto-diagnose on mount
  useEffect(() => {
    const runDiagnosis = async () => {
      addLog(`> Initializing analysis for ${fileName}...`, "info");
      await new Promise(r => setTimeout(r, 500));
      addLog("> Loading file content...", "info");

      try {
        // Get original code
        const fileContent = await getFileContent(selectedFile.file_path);
        setOriginalCode(fileContent.content);
        addLog("> File loaded successfully", "success");

        await new Promise(r => setTimeout(r, 300));
        addLog("> Running AI diagnostics...", "info");

        const diagResult = await diagnoseFile(selectedFile.file_path);
        setDiagnosis(diagResult);

        addLog(`> Analysis complete`, "success");

        if (diagResult.is_healthy) {
          addLog(`> ✓ ${diagResult.issue}`, "success");
          if (diagResult.suggestions.length > 0) {
            addLog(`> Minor suggestions available (optional)`, "info");
          }
          // Don't pre-fill instruction for healthy code
          setInstruction("");
        } else {
          addLog(`> Issue found: ${diagResult.issue}`, diagResult.severity === "high" ? "error" : "warning");
          // Pre-fill instruction with detected issue only for unhealthy code
          setInstruction(diagResult.issue);
        }

        setState("input");
      } catch (err) {
        addLog(`> Error: ${err instanceof Error ? err.message : "Analysis failed"}`, "error");
        setState("input");
      }
    };

    runDiagnosis();
  }, [selectedFile.file_path, fileName]);

  const handleSubmit = async () => {
    const fixInstruction = instruction.trim() || diagnosis?.issue || "Fix any issues in this file";

    setState("loading");
    setLogs([]);

    // Animated terminal logs
    const logSequence = [
      { text: `> Starting Janitor Agent...`, type: "info" as const, delay: 0 },
      { text: `> Target: ${fileName}`, type: "info" as const, delay: 500 },
      { text: `> Instruction: "${fixInstruction.substring(0, 50)}..."`, type: "info" as const, delay: 800 },
      { text: `> Parsing AST with Tree-sitter...`, type: "info" as const, delay: 1500 },
      { text: `> Generating reproduction script...`, type: "info" as const, delay: 3000 },
      { text: `> Testing original code...`, type: "warning" as const, delay: 5000 },
      { text: `> Bug confirmed! Proceeding to fix...`, type: "success" as const, delay: 7000 },
      { text: `> Asking LLM to refactor...`, type: "info" as const, delay: 8000 },
      { text: `> Validating fix in Docker sandbox...`, type: "info" as const, delay: 10000 },
    ];

    // Start log animation
    logSequence.forEach(({ text, type, delay }) => {
      setTimeout(() => addLog(text, type), delay);
    });

    try {
      const fixResult = await fixFile(selectedFile.file_path, fixInstruction);
      setResult(fixResult);

      if (fixResult.status === "success" && fixResult.fixed_code) {
        addLog(`> Fix verified! Test passed.`, "success");
        addLog(`> Ready for review.`, "success");
        await new Promise(r => setTimeout(r, 500));
        setState("review");
      } else {
        addLog(`> Fix failed: ${fixResult.reason}`, "error");
        setError(fixResult.reason || "Unknown error occurred");
        setState("error");
      }
    } catch (err) {
      addLog(`> Error: ${err instanceof Error ? err.message : "Failed"}`, "error");
      setError(err instanceof Error ? err.message : "Failed to fix file");
      setState("error");
    }
  };

  const handleApply = async () => {
    if (!result?.fixed_code) return;

    setState("applying");
    try {
      if (fixMode === "live") {
        // Live Mode: Overwrite the file
        const applyResult = await applyFix(selectedFile.file_path, result.fixed_code);
        if (applyResult.success) {
          setState("success");
          setTimeout(() => {
            onApplied();
            onClose();
          }, 1500);
        } else {
          setError(applyResult.message);
          setState("error");
        }
      } else {
        // Safe Mode: Download the file
        await downloadFix(selectedFile.file_path, result.fixed_code);
        setState("success");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply fix");
      setState("error");
    }
  };

  const severityColors = {
    none: "text-emerald-400 bg-emerald-950/50 border-emerald-500/30",
    low: "text-blue-400 bg-blue-950/50 border-blue-500/30",
    medium: "text-amber-400 bg-amber-950/50 border-amber-500/30",
    high: "text-red-400 bg-red-950/50 border-red-500/30",
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-[#0a0f1a] to-slate-950 border border-cyan-500/30 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl shadow-cyan-900/20">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-cyan-900/30 bg-gradient-to-r from-cyan-950/30 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-xl">
              🤖
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Janitor Agent</h2>
              <p className="text-xs text-cyan-400 font-mono">{fileName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-2xl leading-none p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* State: Diagnosing */}
          {state === "diagnosing" && (
            <div className="space-y-4">
              <TerminalLog logs={logs} logContainerRef={logContainerRef} />
            </div>
          )}

          {/* State: Input */}
          {state === "input" && (
            <div className="space-y-6">
              {/* Diagnosis Result */}
              {diagnosis && (
                <>
                  {/* Healthy Code Banner */}
                  {diagnosis.is_healthy ? (
                    <div className={`p-4 rounded-xl border ${severityColors.none}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">✅</span>
                        <div className="flex-1">
                          <p className="text-xs uppercase tracking-wider opacity-70 mb-1">
                            Code Analysis Result
                          </p>
                          <p className="font-medium text-emerald-300">{diagnosis.issue}</p>

                          {/* Optional Suggestions */}
                          {diagnosis.suggestions.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-emerald-800/30">
                              <p className="text-xs uppercase tracking-wider text-emerald-500/70 mb-2">
                                Optional Improvements (not required)
                              </p>
                              <ul className="space-y-1">
                                {diagnosis.suggestions.map((suggestion, i) => (
                                  <li key={i} className="text-sm text-emerald-400/70 flex items-start gap-2">
                                    <span className="text-emerald-600">•</span>
                                    {suggestion}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Issue Detected Alert */
                    <div className={`p-4 rounded-xl border ${severityColors[diagnosis.severity]}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">
                          {diagnosis.severity === "high" ? "🚨" : diagnosis.severity === "medium" ? "⚠️" : "💡"}
                        </span>
                        <div>
                          <p className="text-xs uppercase tracking-wider opacity-70 mb-1">
                            Issue Detected ({diagnosis.severity} severity)
                          </p>
                          <p className="font-medium">{diagnosis.issue}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Custom instruction */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  {diagnosis?.is_healthy
                    ? "Want to make changes anyway? Describe what you'd like to do:"
                    : "Custom instruction (optional override):"}
                </label>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder={diagnosis?.is_healthy
                    ? "The code looks good, but you can still request specific changes..."
                    : "Leave empty to use detected issue, or override with custom instructions..."}
                  className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none font-mono text-sm"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors"
                >
                  {diagnosis?.is_healthy ? "Close" : "Cancel"}
                </button>
                {/* Only show Fix button if there's an issue OR user typed custom instruction */}
                {(!diagnosis?.is_healthy || instruction.trim()) && (
                  <button
                    onClick={handleSubmit}
                    disabled={diagnosis?.is_healthy && !instruction.trim()}
                    className={`px-8 py-2.5 rounded-lg font-medium transition-all shadow-lg flex items-center gap-2 ${diagnosis?.is_healthy
                        ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-blue-900/30"
                        : "bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 shadow-cyan-900/30"
                      } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span>{diagnosis?.is_healthy ? "🔄" : "🔧"}</span>
                    {diagnosis?.is_healthy ? "Request Changes" : "Fix Now"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* State: Loading */}
          {state === "loading" && (
            <div className="space-y-4">
              <TerminalLog logs={logs} logContainerRef={logContainerRef} />
            </div>
          )}

          {/* State: Review */}
          {state === "review" && result?.fixed_code && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <span className="text-xl">✓</span>
                <span className="font-medium">
                  Fix verified in {result.attempts} attempt{result.attempts !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Side-by-Side Diff View */}
              <div className="grid grid-cols-2 gap-4">
                {/* Original */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 bg-red-500 rounded-full shadow-lg shadow-red-500/50" />
                    <span className="text-sm font-medium text-red-400">Original</span>
                  </div>
                  <div className="bg-red-950/20 border border-red-900/30 rounded-lg overflow-hidden">
                    <pre className="p-4 text-xs text-red-200/80 font-mono overflow-auto max-h-80 whitespace-pre-wrap">
                      {originalCode || "// Original code"}
                    </pre>
                  </div>
                </div>
                {/* Fixed */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50" />
                    <span className="text-sm font-medium text-emerald-400">Fixed</span>
                  </div>
                  <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg overflow-hidden">
                    <pre className="p-4 text-xs text-emerald-200/80 font-mono overflow-auto max-h-80 whitespace-pre-wrap">
                      {result.fixed_code}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Repro Script (collapsible) */}
              {result.repro_script && (
                <details className="mt-4">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 font-mono">
                    &gt; View reproduction script
                  </summary>
                  <div className="mt-2 bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                    <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap">
                      {result.repro_script}
                    </pre>
                  </div>
                </details>
              )}

              {/* Actions with Mode Toggle */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                {/* Mode Toggle */}
                <ModeToggle mode={fixMode} onChange={setFixMode} />

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleApply}
                    className={`px-8 py-2.5 rounded-lg font-medium transition-all shadow-lg flex items-center gap-2 ${fixMode === "safe"
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-900/30"
                        : "bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 shadow-red-900/30"
                      } text-white`}
                  >
                    {fixMode === "safe" ? (
                      <>
                        <span>⬇️</span> Download Copy
                      </>
                    ) : (
                      <>
                        <span>⚡</span> Apply Fix
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* State: Applying */}
          {state === "applying" && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-cyan-900 rounded-full" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-white font-medium">
                {fixMode === "safe" ? "Preparing download..." : "Writing changes to disk..."}
              </p>
            </div>
          )}

          {/* State: Success */}
          {state === "success" && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="text-6xl animate-bounce">🎉</div>
              <p className="text-2xl text-emerald-400 font-bold">
                {fixMode === "safe" ? "Download Started!" : "Fix Applied!"}
              </p>
              <p className="text-gray-500">
                {fixMode === "safe"
                  ? "Check your downloads folder for the fixed file."
                  : "The file has been updated successfully."}
              </p>
              {fixMode === "safe" && (
                <button
                  onClick={onClose}
                  className="mt-4 px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          )}

          {/* State: Error */}
          {state === "error" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-red-400">
                <span className="text-xl">✗</span>
                <span className="font-medium">Operation Failed</span>
              </div>
              <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4">
                <p className="text-red-300 font-mono text-sm">{error}</p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setLogs([]);
                    setState("input");
                  }}
                  className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Mode Toggle Component
function ModeToggle({ mode, onChange }: { mode: FixMode; onChange: (mode: FixMode) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 uppercase tracking-wider">Fix Mode:</span>
      <div className="relative flex bg-gray-900/80 rounded-full p-1 border border-gray-700">
        {/* Background slider */}
        <div
          className={`absolute top-1 bottom-1 w-[calc(50%-2px)] rounded-full transition-all duration-200 ${mode === "safe"
              ? "left-1 bg-gradient-to-r from-emerald-600 to-teal-600"
              : "left-[calc(50%+1px)] bg-gradient-to-r from-orange-600 to-red-600"
            }`}
        />

        {/* Safe button */}
        <button
          onClick={() => onChange("safe")}
          className={`relative z-10 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${mode === "safe" ? "text-white" : "text-gray-500 hover:text-gray-300"
            }`}
        >
          🛡️ Safe
        </button>

        {/* Live button */}
        <button
          onClick={() => onChange("live")}
          className={`relative z-10 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${mode === "live" ? "text-white" : "text-gray-500 hover:text-gray-300"
            }`}
        >
          ⚡ Live
        </button>
      </div>

      {/* Mode indicator text */}
      <span className={`text-xs font-medium ${mode === "safe" ? "text-emerald-400" : "text-orange-400"}`}>
        {mode === "safe" ? "Downloads a copy" : "Overwrites file"}
      </span>
    </div>
  );
}

// Terminal Log Component
function TerminalLog({
  logs,
  logContainerRef
}: {
  logs: LogEntry[];
  logContainerRef: React.RefObject<HTMLDivElement | null>
}) {
  const typeColors = {
    info: "text-cyan-400",
    success: "text-emerald-400",
    error: "text-red-400",
    warning: "text-amber-400",
  };

  return (
    <div className="bg-black/50 border border-cyan-900/30 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-cyan-950/30 border-b border-cyan-900/30">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
        </div>
        <span className="text-xs text-gray-500 font-mono ml-2">janitor-agent — bash</span>
      </div>
      <div
        ref={logContainerRef}
        className="p-4 h-64 overflow-y-auto font-mono text-sm space-y-1"
      >
        {logs.map((log, i) => (
          <div key={i} className={`${typeColors[log.type]} animate-fade-in`}>
            {log.text}
          </div>
        ))}
        <div className="inline-block w-2 h-4 bg-cyan-400 animate-pulse ml-1" />
      </div>
    </div>
  );
}
