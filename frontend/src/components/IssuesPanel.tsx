import { useMemo } from "react";
import type { FileIssue, FileAnalysis } from "../api";

interface IssuesPanelProps {
  issues: FileIssue[];
  isLoading: boolean;
  onIssueClick: (filePath: string) => void;
  files: FileAnalysis[];
}

/**
 * Panel displaying detected bugs and issues across the codebase.
 * Shows high-priority issues that need user attention.
 */
export function IssuesPanel({ issues, isLoading, onIssueClick, files }: IssuesPanelProps) {
  const severityConfig = {
    high: {
      icon: "🚨",
      bgColor: "bg-red-950/40",
      borderColor: "border-red-500/50",
      textColor: "text-red-400",
      badge: "bg-red-500/20 text-red-300 border-red-500/30",
      glow: "shadow-red-500/20",
    },
    medium: {
      icon: "⚠️",
      bgColor: "bg-amber-950/40",
      borderColor: "border-amber-500/50",
      textColor: "text-amber-400",
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      glow: "shadow-amber-500/20",
    },
    low: {
      icon: "💡",
      bgColor: "bg-blue-950/40",
      borderColor: "border-blue-500/50",
      textColor: "text-blue-400",
      badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      glow: "shadow-blue-500/20",
    },
  };

  const groupedIssues = useMemo(() => {
    const high = issues.filter((i) => i.severity === "high");
    const medium = issues.filter((i) => i.severity === "medium");
    const low = issues.filter((i) => i.severity === "low");
    return { high, medium, low };
  }, [issues]);

  const handleClick = (issue: FileIssue) => {
    // Find the matching file from files array
    const matchingFile = files.find(f => f.file_path === issue.file_path);
    if (matchingFile) {
      onIssueClick(issue.file_path);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gray-800 rounded-lg" />
          <div className="h-6 w-40 bg-gray-800 rounded" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-800/50 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="bg-gradient-to-br from-emerald-950/30 to-cyan-950/20 border border-emerald-500/30 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">✨</span>
            <h3 className="text-lg font-semibold text-emerald-400">All Clear!</h3>
          </div>
          <p className="text-gray-400 text-sm">
            No critical bugs detected in your codebase. The Janitor Agent found no issues that require immediate attention.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 relative overflow-hidden">
      {/* Decorative glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-500/10 rounded-full blur-3xl" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center text-xl shadow-lg shadow-red-900/30">
            🔍
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Issues Detected</h3>
            <p className="text-xs text-gray-500">
              {issues.length} issue{issues.length !== 1 ? "s" : ""} found requiring attention
            </p>
          </div>
        </div>
        
        {/* Severity summary badges */}
        <div className="flex gap-2">
          {groupedIssues.high.length > 0 && (
            <span className="px-2 py-1 text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30 rounded-full">
              {groupedIssues.high.length} critical
            </span>
          )}
          {groupedIssues.medium.length > 0 && (
            <span className="px-2 py-1 text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
              {groupedIssues.medium.length} warning
            </span>
          )}
          {groupedIssues.low.length > 0 && (
            <span className="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full">
              {groupedIssues.low.length} info
            </span>
          )}
        </div>
      </div>

      {/* Issues list */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar relative">
        {issues.map((issue, index) => {
          const config = severityConfig[issue.severity];
          return (
            <button
              key={`${issue.file_path}-${index}`}
              onClick={() => handleClick(issue)}
              className={`w-full text-left p-4 rounded-lg border ${config.bgColor} ${config.borderColor} 
                hover:scale-[1.01] transition-all duration-200 group cursor-pointer
                shadow-lg ${config.glow}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">{config.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-semibold ${config.textColor} truncate`}>
                      {issue.file_name}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded-full border ${config.badge}`}>
                      {issue.severity}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 line-clamp-2">{issue.issue}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>🧠 {issue.cognitive_complexity}</span>
                    <span>📊 MI: {issue.maintainability_index.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="mt-4 pt-3 border-t border-gray-800 text-center">
        <p className="text-xs text-gray-500">
          Click an issue to open the Janitor Agent and fix it
        </p>
      </div>
    </div>
  );
}

