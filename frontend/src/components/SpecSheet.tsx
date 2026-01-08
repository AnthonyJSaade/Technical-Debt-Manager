/**
 * SpecSheet Component - Technical Specification Panel
 *
 * Displays detailed file information in a CAD-style spec sheet format.
 * Shows module documentation, complexity metrics, and maintenance actions.
 */

import { useState } from "react";
import { getFileContent } from "../api";
import type { FileAnalysis } from "../api";

interface SpecSheetProps {
  file: FileAnalysis;
  onClose: () => void;
  onInitiateMaintenance: () => void;
}

/**
 * Get status color based on Maintainability Index.
 */
function getStatusColor(mi: number): { color: string; label: string; bg: string; border: string } {
  if (mi >= 65) return {
    color: "text-emerald-400",
    label: "NOMINAL",
    bg: "bg-emerald-950/20",
    border: "border-emerald-500/30"
  };
  if (mi >= 40) return {
    color: "text-amber-400",
    label: "DEGRADED",
    bg: "bg-amber-950/20",
    border: "border-amber-500/30"
  };
  return {
    color: "text-red-400",
    label: "CRITICAL",
    bg: "bg-red-950/20",
    border: "border-red-500/30"
  };
}

/**
 * Get complexity rating label.
 */
function getComplexityRating(cc: number): { label: string; color: string } {
  if (cc < 5) return { label: "LOW", color: "text-emerald-400" };
  if (cc <= 15) return { label: "MODERATE", color: "text-amber-400" };
  if (cc <= 30) return { label: "HIGH", color: "text-orange-400" };
  return { label: "VERY HIGH", color: "text-red-400" };
}

export function SpecSheet({ file, onClose, onInitiateMaintenance }: SpecSheetProps) {
  const [showCode, setShowCode] = useState(false);
  const [codeContent, setCodeContent] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);

  const status = getStatusColor(file.maintainability_index);
  const complexity = getComplexityRating(file.cognitive_complexity);
  const fileName = file.file_path.split("/").pop() || file.file_path;

  const handleViewCode = async () => {
    setShowCode(true);
    if (!codeContent) {
      setLoadingCode(true);
      try {
        const data = await getFileContent(file.file_path);
        setCodeContent(data.content);
      } catch (err) {
        setCodeContent(`Error loading code: ${err}`);
      } finally {
        setLoadingCode(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-[#0a0f1a] to-slate-950 border border-cyan-500/30 rounded-2xl w-full max-w-3xl shadow-2xl shadow-cyan-900/20 flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header - Premium Blueprint Style */}
        <div className="px-6 py-4 border-b border-cyan-900/30 bg-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full animate-pulse ${status.bg.replace('/20', '')}`} />
            <div>
              <div className="text-xs text-cyan-400/70 uppercase tracking-widest font-semibold font-mono">
                Component Specification
              </div>
              <div className="text-lg text-white font-bold tracking-tight">
                {fileName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Activate Janitor Button - Promoted to Header */}
            <button
              onClick={onInitiateMaintenance}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-bold uppercase tracking-wider transition-all hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]"
            >
              <span className="text-lg">🤖</span> Activate Janitor
            </button>

            <div className="h-8 w-px bg-white/10 mx-2" />

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className={`px-6 py-3 border-b flex items-center justify-between ${status.bg} ${status.border} shrink-0`}>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">STATUS:</span>
            <span className={`text-sm font-bold uppercase tracking-wider ${status.color}`}>
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-slate-500">
              ID: <span className="text-slate-300">{file.id?.toString().padStart(4, '0')}</span>
            </span>
            <span className="text-slate-500">
              LAST SCAN: <span className="text-slate-300">
                {new Date(file.last_analyzed).toLocaleDateString()}
              </span>
            </span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">

          {/* Function / Description */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-cyan-500/70 text-sm">┌</span>
              <h3 className="text-xs text-cyan-400 uppercase tracking-widest font-semibold">Function</h3>
              <div className="flex-1 border-t border-dashed border-cyan-900/50" />
            </div>
            <div className="bg-slate-900/50 border border-cyan-900/30 rounded-lg p-4 text-slate-300 text-sm leading-relaxed font-light">
              {file.description || (
                <span className="text-slate-600 italic">
                  No documentation available. Consider tasking the Janitor to add a module docstring.
                </span>
              )}
            </div>
          </section>

          {/* Metrics Grid */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-cyan-500/70 text-sm">┌</span>
              <h3 className="text-xs text-cyan-400 uppercase tracking-widest font-semibold">Metrics</h3>
              <div className="flex-1 border-t border-dashed border-cyan-900/50" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Maintainability Index */}
              <div className="bg-slate-900/50 border border-cyan-900/30 rounded-lg p-4 relative overflow-hidden group hover:border-cyan-500/30 transition-colors">
                <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-transparent to-${status.color.split('-')[1]}-500/10 rounded-bl-3xl`} />
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
                  Maintainability Index
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${status.color}`}>
                    {file.maintainability_index.toFixed(0)}
                  </span>
                  <span className="text-slate-600 text-sm font-medium">/ 100</span>
                </div>
                <div className="mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${status.bg.replace('/20', '')}`}
                    style={{ width: `${file.maintainability_index}%` }}
                  />
                </div>
              </div>

              {/* Cognitive Complexity */}
              <div className="bg-slate-900/50 border border-cyan-900/30 rounded-lg p-4 hover:border-cyan-500/30 transition-colors">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
                  Cognitive Complexity
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${complexity.color}`}>
                    {file.cognitive_complexity}
                  </span>
                  <span className={`text-xs uppercase tracking-wider font-bold ${complexity.color}`}>
                    {complexity.label}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Control flow nesting depth
                </div>
              </div>

              {/* Lines of Code */}
              <div className="bg-slate-900/50 border border-cyan-900/30 rounded-lg p-4 hover:border-cyan-500/30 transition-colors">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
                  Volume
                </div>
                <div className="text-2xl font-bold text-slate-200">
                  {file.lines_of_code.toLocaleString()} <span className="text-sm font-normal text-slate-500">LOC</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Halstead Volume: {file.halstead_volume.toFixed(0)}
                </div>
              </div>

              {/* Technical Debt */}
              <div className="bg-slate-900/50 border border-cyan-900/30 rounded-lg p-4 hover:border-cyan-500/30 transition-colors">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
                  Est. Remediation Time
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-amber-400">
                    {file.sqale_debt_hours.toFixed(1)}
                  </span>
                  <span className="text-slate-500 text-sm">hours</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  SQALE Method
                </div>
              </div>
            </div>
          </section>

          {/* Location / Actions */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-cyan-500/70 text-sm">┌</span>
              <h3 className="text-xs text-cyan-400 uppercase tracking-widest font-semibold">Source Location</h3>
              <div className="flex-1 border-t border-dashed border-cyan-900/50" />
            </div>

            <div className="flex gap-4">
              <div className="bg-black/40 border border-cyan-900/30 rounded-lg p-3 flex-1 font-mono text-xs text-slate-400 overflow-x-auto whitespace-nowrap flex items-center">
                {file.file_path}
              </div>

              <button
                onClick={handleViewCode}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors flex items-center gap-2 shrink-0 border border-slate-700"
              >
                <span>📄</span> View Code
              </button>
            </div>
          </section>
        </div>

      </div>

      {/* View Code Modal (Overlay) */}
      {showCode && (
        <div className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in">
          <div className="bg-[#0d1117] border border-slate-700 rounded-xl w-full h-full max-w-6xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📄</span>
                <span className="font-mono text-slate-200">{fileName}</span>
              </div>
              <button
                onClick={() => setShowCode(false)}
                className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Close Viewer
              </button>
            </div>
            <div className="flex-1 overflow-auto p-0 bg-[#0d1117] relative">
              {loadingCode ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                  <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                  Loading content...
                </div>
              ) : (
                <pre className="p-6 font-mono text-sm text-slate-300 leading-relaxed">
                  {codeContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
