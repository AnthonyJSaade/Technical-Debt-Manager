import type { FileAnalysis, FileIssue } from "../api";
import { StaticNetwork } from "./StaticNetwork";

interface CodeMapProps {
  files: FileAnalysis[];
  issues?: FileIssue[];
  onFileClick?: (file: FileAnalysis) => void;
}

export function CodeMap({ files, issues = [], onFileClick }: CodeMapProps) {
  return (
    <div className="h-[600px] border border-slate-700 bg-[#0f172a] rounded-lg overflow-hidden shadow-xl">
      {files.length > 0 ? (
        <StaticNetwork files={files} issues={issues} onFileClick={onFileClick} />
      ) : (
        <div className="flex h-full items-center justify-center text-slate-500 font-mono">
          Waiting for project scan...
        </div>
      )}
    </div>
  );
}
