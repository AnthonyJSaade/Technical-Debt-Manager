import React, { useMemo, useState } from "react";
import type { FileAnalysis } from "../api";

interface FileTreeProps {
    files: FileAnalysis[];
    activeFile: FileAnalysis | null;
    onSelectFile: (file: FileAnalysis) => void;
}

interface TreeNode {
    name: string;
    path: string;
    type: "file" | "folder";
    children: Record<string, TreeNode>;
    fileData?: FileAnalysis;
    complexity?: number;
}

// Color constants matching the blueprint theme
const COLORS = {
    textPrimary: "#f8fafc",    // Slate-50
    textSecondary: "#94a3b8",  // Slate-400
    folder: "#38bdf8",         // Sky-400
    file: "#e2e8f0",           // Slate-200
    hover: "#1e293b",          // Slate-800
    active: "#1e3a5f",         // Navy Blue (Selected)
    statusGreen: "#34d399",    // Emerald-400
    statusYellow: "#fbbf24",   // Amber-400
    statusRed: "#f87171",      // Red-400
};

function getStatusColor(mi: number): string {
    if (mi >= 85) return COLORS.statusGreen;
    if (mi >= 65) return COLORS.statusYellow;
    return COLORS.statusRed;
}

const FileTreeNode: React.FC<{
    node: TreeNode;
    level: number;
    activeFile: FileAnalysis | null;
    onSelectFile: (file: FileAnalysis) => void;
}> = ({ node, level, activeFile, onSelectFile }) => {
    const [isOpen, setIsOpen] = useState(true);

    const isFolder = node.type === "folder";
    const isActive = node.fileData && activeFile?.id === node.fileData.id;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFolder) {
            setIsOpen(!isOpen);
        } else if (node.fileData) {
            onSelectFile(node.fileData);
        }
    };

    return (
        <div>
            <div
                onClick={handleClick}
                className={`
          flex items-center gap-2 py-1 px-2 cursor-pointer select-none
          font-mono text-sm transition-colors duration-150
          ${isActive ? "bg-[#1e3a5f] text-cyan-400" : "text-slate-400 hover:bg-[#1e293b]"}
        `}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
            >
                <span className="opacity-70 w-4 text-center">
                    {isFolder ? (isOpen ? "▼" : "▶") : "•"}
                </span>

                {isFolder ? (
                    <span className="text-sky-400 font-bold">
                        {node.name}/
                    </span>
                ) : (
                    <div className="flex items-center gap-2 flex-1">
                        <span className={isActive ? "text-cyan-300" : "text-slate-300"}>
                            {node.name}
                        </span>
                        {node.fileData && (
                            <div
                                className="w-2 h-2 rounded-full ml-auto"
                                style={{ backgroundColor: getStatusColor(node.fileData.maintainability_index) }}
                                title={`MI: ${node.fileData.maintainability_index}`}
                            />
                        )}
                    </div>
                )}
            </div>

            {isFolder && isOpen && (
                <div>
                    {Object.values(node.children)
                        .sort((a, b) => {
                            if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
                            return a.name.localeCompare(b.name);
                        })
                        .map((child) => (
                            <FileTreeNode
                                key={child.path}
                                node={child}
                                level={level + 1}
                                activeFile={activeFile}
                                onSelectFile={onSelectFile}
                            />
                        ))}
                </div>
            )}
        </div>
    );
};

export function FileTree({ files, activeFile, onSelectFile }: FileTreeProps) {
    const tree = useMemo(() => {
        const root: TreeNode = {
            name: "root",
            path: "",
            type: "folder",
            children: {},
        };

        files.forEach((file) => {
            const parts = file.file_path.split("/");
            let current = root;

            parts.forEach((part, index) => {
                const isFile = index === parts.length - 1;
                const path = parts.slice(0, index + 1).join("/");

                if (!current.children[part]) {
                    current.children[part] = {
                        name: part,
                        path,
                        type: isFile ? "file" : "folder",
                        children: {},
                        fileData: isFile ? file : undefined,
                    };
                }
                current = current.children[part];
            });
        });

        return root;
    }, [files]);

    if (files.length === 0) {
        return (
            <div className="p-8 text-slate-500 text-center font-mono text-xs uppercase tracking-widest">
                No Files Loaded
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto overflow-x-hidden py-2 custom-scrollbar">
            {Object.values(tree.children)
                .sort((a, b) => {
                    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
                    return a.name.localeCompare(b.name);
                })
                .map((node) => (
                    <FileTreeNode
                        key={node.path}
                        node={node}
                        level={0}
                        activeFile={activeFile}
                        onSelectFile={onSelectFile}
                    />
                ))}
        </div>
    );
}
