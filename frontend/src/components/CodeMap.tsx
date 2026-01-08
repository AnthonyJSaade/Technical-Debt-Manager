import { useState } from "react";
import type { FileAnalysis, FileIssue } from "../api";
import { StaticNetwork } from "./StaticNetwork";
import { FileTree } from "./FileTree";

interface CodeMapProps {
  files: FileAnalysis[];
  issues?: FileIssue[];
  selectedFile?: FileAnalysis | null;
  onFileClick?: (file: FileAnalysis) => void;
}

export function CodeMap({ files, issues = [], selectedFile = null, onFileClick }: CodeMapProps) {
  const [viewMode, setViewMode] = useState<"network" | "tree">("network");

  return (
    <div className="h-[600px] glass-panel rounded-2xl overflow-hidden shadow-2xl flex flex-col relative transition-all duration-500 hover:shadow-cyan-900/20 group">

      {/* Ambient Background Glow within map */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-cyan-500/5 pointer-events-none" />

      {/* Header / Toolbar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-900/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-mono text-cyan-200/70 tracking-widest uppercase">
            Architecture v1.0 • {files.length} Modules
          </span>
        </div>

        {/* Premium Segmented Control */}
        <div className="flex bg-slate-950/50 p-1 rounded-lg border border-white/5">
          <button
            onClick={() => setViewMode("network")}
            className={`
                            px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-300
                            flex items-center gap-2
                            ${viewMode === "network"
                ? "bg-slate-800 text-cyan-400 shadow-lg shadow-black/20 border border-white/5"
                : "text-slate-500 hover:text-slate-300"
              }
                        `}
          >
            <span>🌐</span> Network
          </button>
          <button
            onClick={() => setViewMode("tree")}
            className={`
                            px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-300
                            flex items-center gap-2
                            ${viewMode === "tree"
                ? "bg-slate-800 text-cyan-400 shadow-lg shadow-black/20 border border-white/5"
                : "text-slate-500 hover:text-slate-300"
              }
                        `}
          >
            <span>📄</span> Tree
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative z-0">
        {files.length > 0 ? (
          viewMode === "network" ? (
            <StaticNetwork files={files} issues={issues} onFileClick={onFileClick} />
          ) : (
            <div className="h-full bg-slate-950/30 p-2">
              <FileTree
                files={files}
                activeFile={selectedFile}
                onSelectFile={(f) => onFileClick?.(f)}
              />
            </div>
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-slate-500 gap-4">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-700 animate-spin-slow flex items-center justify-center">
              <div className="w-2 h-2 bg-slate-600 rounded-full" />
            </div>
            <p className="font-mono text-xs uppercase tracking-widest opacity-50">System Idle • Waiting for Scan</p>
          </div>
        )}
      </div>
    </div>
  );
}
