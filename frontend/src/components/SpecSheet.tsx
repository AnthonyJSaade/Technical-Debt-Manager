/**
 * SpecSheet Component - Technical Specification Panel
 *
 * Displays detailed file information in a CAD-style spec sheet format.
 * Shows module documentation, complexity metrics, and maintenance actions.
 */

import type { FileAnalysis } from "../api";

interface SpecSheetProps {
  file: FileAnalysis;
  onClose: () => void;
  onInitiateMaintenance: () => void;
}

/**
 * Get status color based on Maintainability Index.
 */
function getStatusColor(mi: number): { color: string; label: string; bg: string } {
  if (mi >= 65) return { 
    color: "#34d399", 
    label: "NOMINAL", 
    bg: "rgba(52, 211, 153, 0.1)" 
  };
  if (mi >= 40) return { 
    color: "#fbbf24", 
    label: "DEGRADED", 
    bg: "rgba(251, 191, 36, 0.1)" 
  };
  return { 
    color: "#f87171", 
    label: "CRITICAL", 
    bg: "rgba(248, 113, 113, 0.1)" 
  };
}

/**
 * Get complexity rating label.
 */
function getComplexityRating(cc: number): { label: string; color: string } {
  if (cc < 5) return { label: "LOW", color: "#34d399" };
  if (cc <= 15) return { label: "MODERATE", color: "#fbbf24" };
  if (cc <= 30) return { label: "HIGH", color: "#fb923c" };
  return { label: "VERY HIGH", color: "#f87171" };
}

/**
 * Extract filename from path.
 */
function getFileName(filePath: string): string {
  return filePath.split("/").pop() || filePath;
}

export function SpecSheet({ file, onClose, onInitiateMaintenance }: SpecSheetProps) {
  const status = getStatusColor(file.maintainability_index);
  const complexity = getComplexityRating(file.cognitive_complexity);
  const fileName = getFileName(file.file_path);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="w-full max-w-2xl border-2 rounded shadow-2xl font-mono overflow-hidden"
        style={{ 
          backgroundColor: "#0f172a",
          borderColor: "#60a5fa60",
          boxShadow: "0 0 60px rgba(96, 165, 250, 0.15)",
        }}
      >
        {/* Header - Blueprint style */}
        <div 
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: "#60a5fa30" }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ backgroundColor: status.color }}
            />
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-widest">
                Component Specification
              </div>
              <div className="text-lg text-slate-100 font-bold">
                {fileName}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-2xl leading-none p-2 hover:bg-slate-800 rounded transition-colors"
          >
            ×
          </button>
        </div>

        {/* Status Bar */}
        <div 
          className="px-6 py-3 border-b flex items-center justify-between"
          style={{ 
            backgroundColor: status.bg,
            borderColor: "#60a5fa30",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">STATUS:</span>
            <span 
              className="text-sm font-bold uppercase tracking-wider"
              style={{ color: status.color }}
            >
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-500">
              ID: <span className="text-slate-400">{file.id.toString().padStart(4, '0')}</span>
            </span>
            <span className="text-slate-500">
              LAST SCAN: <span className="text-slate-400">
                {new Date(file.last_analyzed).toLocaleDateString()}
              </span>
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Function / Description */}
          <section>
            <div className="text-xs text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <span>┌</span>
              <span>Function</span>
              <div className="flex-1 border-t border-dashed" style={{ borderColor: "#60a5fa20" }} />
            </div>
            <div 
              className="text-sm text-slate-300 leading-relaxed p-4 rounded border"
              style={{ 
                backgroundColor: "#1e293b40",
                borderColor: "#60a5fa20",
              }}
            >
              {file.description || (
                <span className="text-slate-500 italic">
                  No documentation available. Consider adding a module docstring.
                </span>
              )}
            </div>
          </section>

          {/* Metrics Grid */}
          <section>
            <div className="text-xs text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span>┌</span>
              <span>Metrics</span>
              <div className="flex-1 border-t border-dashed" style={{ borderColor: "#60a5fa20" }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Maintainability Index */}
              <div 
                className="p-4 rounded border"
                style={{ backgroundColor: "#1e293b40", borderColor: "#60a5fa20" }}
              >
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                  Maintainability Index
                </div>
                <div className="flex items-baseline gap-2">
                  <span 
                    className="text-3xl font-bold"
                    style={{ color: status.color }}
                  >
                    {file.maintainability_index.toFixed(0)}
                  </span>
                  <span className="text-slate-500 text-sm">/ 100</span>
                </div>
                <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all"
                    style={{ 
                      width: `${file.maintainability_index}%`,
                      backgroundColor: status.color,
                    }}
                  />
                </div>
              </div>

              {/* Cognitive Complexity */}
              <div 
                className="p-4 rounded border"
                style={{ backgroundColor: "#1e293b40", borderColor: "#60a5fa20" }}
              >
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                  Cognitive Complexity
                </div>
                <div className="flex items-baseline gap-2">
                  <span 
                    className="text-3xl font-bold"
                    style={{ color: complexity.color }}
                  >
                    {file.cognitive_complexity}
                  </span>
                  <span 
                    className="text-xs uppercase tracking-wider"
                    style={{ color: complexity.color }}
                  >
                    {complexity.label}
                  </span>
                </div>
              </div>

              {/* Lines of Code */}
              <div 
                className="p-4 rounded border"
                style={{ backgroundColor: "#1e293b40", borderColor: "#60a5fa20" }}
              >
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                  Lines of Code
                </div>
                <div className="text-2xl font-bold text-slate-200">
                  {file.lines_of_code}
                </div>
              </div>

              {/* Technical Debt */}
              <div 
                className="p-4 rounded border"
                style={{ backgroundColor: "#1e293b40", borderColor: "#60a5fa20" }}
              >
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                  Est. Remediation Time
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-amber-400">
                    {file.sqale_debt_hours.toFixed(1)}
                  </span>
                  <span className="text-slate-500 text-sm">hours</span>
                </div>
              </div>
            </div>
          </section>

          {/* File Path */}
          <section>
            <div className="text-xs text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <span>┌</span>
              <span>Location</span>
              <div className="flex-1 border-t border-dashed" style={{ borderColor: "#60a5fa20" }} />
            </div>
            <div 
              className="text-xs text-slate-400 p-3 rounded border overflow-x-auto"
              style={{ 
                backgroundColor: "#0f172a",
                borderColor: "#60a5fa20",
              }}
            >
              <code>{file.file_path}</code>
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div 
          className="px-6 py-4 border-t flex items-center justify-between"
          style={{ 
            borderColor: "#60a5fa30",
            backgroundColor: "#1e293b20",
          }}
        >
          <div className="text-xs text-slate-500">
            Halstead Volume: {file.halstead_volume.toFixed(0)} • 
            Cyclomatic: {file.complexity_score}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Close
            </button>
            <button
              onClick={onInitiateMaintenance}
              className="px-5 py-2 text-sm font-bold uppercase tracking-wider rounded transition-all"
              style={{
                backgroundColor: "#22d3ee20",
                color: "#22d3ee",
                border: "1px solid #22d3ee60",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#22d3ee30";
                e.currentTarget.style.boxShadow = "0 0 20px rgba(34, 211, 238, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#22d3ee20";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              ⚙ Initiate Maintenance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

