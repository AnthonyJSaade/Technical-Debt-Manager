import { useState, useEffect, useCallback } from "react";
import { browseDirectory } from "../api";
import type { DirectoryEntry, BrowseResult } from "../api";

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (path: string) => void;
  isScanning: boolean;
}

/**
 * Modal with a native-like folder browser for selecting directories to scan.
 */
export function ScanModal({ isOpen, onClose, onScan, isScanning }: ScanModalProps) {
  const [browseData, setBrowseData] = useState<BrowseResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // Load directory contents
  const loadDirectory = useCallback(async (path?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await browseDirectory(path);
      setBrowseData(data);
      setSelectedPath(null); // Clear selection when navigating
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to browse directory");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load home directory on open
  useEffect(() => {
    if (isOpen && !browseData) {
      loadDirectory();
    }
  }, [isOpen, browseData, loadDirectory]);

  // Handle folder double-click (navigate into)
  const handleNavigate = (entry: DirectoryEntry) => {
    if (entry.is_dir) {
      loadDirectory(entry.path);
    }
  };

  // Handle single click (select)
  const handleSelect = (entry: DirectoryEntry) => {
    if (entry.is_dir) {
      setSelectedPath(entry.path);
    }
  };

  // Handle go up
  const handleGoUp = () => {
    if (browseData?.parent_path) {
      loadDirectory(browseData.parent_path);
    }
  };

  // Handle scan current or selected directory
  const handleScan = () => {
    const pathToScan = selectedPath || browseData?.current_path;
    if (pathToScan) {
      onScan(pathToScan);
    }
  };

  // Handle selecting current directory
  const handleSelectCurrent = () => {
    if (browseData?.current_path) {
      setSelectedPath(browseData.current_path);
    }
  };

  if (!isOpen) return null;

  // Get folder count for display
  const folderCount = browseData?.entries.filter(e => e.is_dir).length || 0;
  const fileCount = browseData?.entries.filter(e => !e.is_dir).length || 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d1117] border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header - macOS style */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-gray-800 to-gray-850 border-b border-gray-700">
          <div className="flex items-center gap-2">
            {/* Traffic lights */}
            <button
              onClick={onClose}
              disabled={isScanning}
              className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 disabled:opacity-50"
            />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-sm font-medium text-gray-300">Select Folder to Scan</span>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/50 border-b border-gray-800">
          {/* Navigation buttons */}
          <button
            onClick={handleGoUp}
            disabled={!browseData?.parent_path || isLoading}
            className="p-2 rounded-lg hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Go up"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          
          <button
            onClick={() => loadDirectory()}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-gray-800 disabled:opacity-30 transition-colors"
            title="Go to Home"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>

          <button
            onClick={() => loadDirectory(browseData?.current_path)}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-gray-800 disabled:opacity-30 transition-colors"
            title="Refresh"
          >
            <svg className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Path breadcrumb */}
          <div className="flex-1 ml-2">
            <div className="flex items-center gap-1 text-sm text-gray-400 font-mono bg-gray-900 rounded-lg px-3 py-1.5 overflow-x-auto">
              <span className="text-cyan-400">📁</span>
              <span className="truncate">{browseData?.current_path || "Loading..."}</span>
            </div>
          </div>
        </div>

        {/* File browser */}
        <div className="flex-1 overflow-y-auto min-h-[300px] bg-[#0a0f14]">
          {error ? (
            <div className="p-8 text-center">
              <span className="text-red-400">⚠️ {error}</span>
              <button
                onClick={() => loadDirectory()}
                className="mt-4 block mx-auto text-sm text-cyan-400 hover:text-cyan-300"
              >
                Go to Home
              </button>
            </div>
          ) : isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <p className="mt-2 text-gray-500 text-sm">Loading...</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {/* Current directory option */}
              <button
                onClick={handleSelectCurrent}
                onDoubleClick={handleScan}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  selectedPath === browseData?.current_path
                    ? "bg-cyan-900/30 border-l-2 border-cyan-500"
                    : "hover:bg-gray-800/50"
                }`}
              >
                <span className="text-xl">📂</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-cyan-400 text-sm">. (Current Folder)</div>
                  <div className="text-xs text-gray-500 truncate">
                    Scan this folder: {browseData?.current_path}
                  </div>
                </div>
              </button>

              {/* Directory entries */}
              {browseData?.entries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => handleSelect(entry)}
                  onDoubleClick={() => handleNavigate(entry)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    selectedPath === entry.path
                      ? "bg-cyan-900/30 border-l-2 border-cyan-500"
                      : "hover:bg-gray-800/50"
                  }`}
                >
                  <span className="text-xl">
                    {entry.is_dir ? "📁" : entry.name.endsWith(".py") ? "🐍" : "📄"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm truncate ${entry.is_dir ? "text-gray-200" : "text-gray-500"}`}>
                      {entry.name}
                    </div>
                    {entry.is_dir && (
                      <div className="text-xs text-gray-600">Double-click to open</div>
                    )}
                  </div>
                  {entry.is_dir && (
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              ))}

              {browseData?.entries.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <span className="text-2xl">📭</span>
                  <p className="mt-2 text-sm">This folder is empty</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-900/50 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {folderCount} folders, {fileCount} files
              {selectedPath && (
                <span className="ml-2 text-cyan-400">
                  • Selected: {selectedPath.split("/").pop()}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={isScanning}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleScan}
                disabled={isScanning || (!selectedPath && !browseData?.current_path)}
                className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${
                  isScanning || (!selectedPath && !browseData?.current_path)
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-900/30"
                }`}
              >
                {isScanning ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Scanning...
                  </span>
                ) : (
                  <>Scan {selectedPath ? "Selected" : "Current"} Folder</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
