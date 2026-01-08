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

// Premium Colors
const COLORS = {
    folderIcon: "#f59e0b",     // Amber-500
    fileIcon: "#94a3b8",       // Slate-400
    fileIconActive: "#22d3ee", // Cyan-400
    textPrimary: "#f1f5f9",    // Slate-100
    textSecondary: "#64748b",  // Slate-500
    hoverBg: "rgba(148, 163, 184, 0.05)",
    activeBg: "rgba(6, 182, 212, 0.1)",
    borderLeftActive: "#06b6d4",
};

function getStatusColor(mi: number): string {
    if (mi >= 85) return "#34d399"; // Green
    if (mi >= 65) return "#fcd34d"; // Yellow
    return "#f87171"; // Red
}

const FileTreeNode: React.FC<{
    node: TreeNode;
    level: number;
    activeFile: FileAnalysis | null;
    onSelectFile: (file: FileAnalysis) => void;
}> = ({ node, level, activeFile, onSelectFile }) => {
    const [isOpen, setIsOpen] = useState(true); // Default open for better visibility

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
                  group flex items-center gap-2 py-1.5 px-3 cursor-pointer select-none
                  text-sm transition-all duration-200 border-l-2
                  ${isActive
                        ? "bg-[rgba(6,182,212,0.1)] border-cyan-400"
                        : "border-transparent hover:bg-white/5 hover:border-white/10"
                    }
                `}
                style={{ paddingLeft: `${level * 16 + 12}px` }}
            >
                {/* Expander Icon */}
                <span className={`
                    w-4 h-4 flex items-center justify-center text-[10px] text-slate-500 transition-transform duration-200
                    ${isFolder ? (isOpen ? "rotate-90" : "rotate-0") : "opacity-0"}
                `}>
                    ▶
                </span>

                {/* Type Icon */}
                <span className="text-base leading-none">
                    {isFolder ? (
                        <span style={{ color: COLORS.folderIcon }}>{isOpen ? "📂" : "📁"}</span>
                    ) : (
                        <span style={{ color: isActive ? COLORS.fileIconActive : COLORS.fileIcon }}>📄</span>
                    )}
                </span>

                {/* Name */}
                <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className={`
                        truncate font-mono text-xs tracking-wide
                        ${isActive ? "text-cyan-100 font-medium" : (isFolder ? "text-slate-300 font-medium" : "text-slate-400 group-hover:text-slate-200")}
                    `}>
                        {node.name}
                    </span>

                    {/* Health Indicator Dot */}
                    {node.fileData && (
                        <div
                            className="w-1.5 h-1.5 rounded-full shadow-sm ml-2 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
                            style={{
                                backgroundColor: getStatusColor(node.fileData.maintainability_index),
                                boxShadow: isActive ? `0 0 8px ${getStatusColor(node.fileData.maintainability_index)}` : 'none'
                            }}
                            title={`MI: ${node.fileData.maintainability_index}`}
                        />
                    )}
                </div>
            </div>

            {/* Recursion */}
            {isFolder && isOpen && (
                <div className="relative">
                    {/* Indent Guide Line */}
                    <div
                        className="absolute left-0 top-0 bottom-0 w-px bg-slate-800/50"
                        style={{ left: `${level * 16 + 19}px` }}
                    />

                    {Object.values(node.children)
                        .sort((a, b) => {
                            // Folders first, then files
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

        // Try to unwrap single root folders to avoid "Project/Project" nesting
        // E.g. if root only has 1 child "RepoVision", start displaying from there.
        let displayRoot = root;
        while (
            Object.keys(displayRoot.children).length === 1 &&
            Object.values(displayRoot.children)[0].type === "folder"
        ) {
            displayRoot = Object.values(displayRoot.children)[0];
        }

        return displayRoot;
    }, [files]);

    if (files.length === 0) {
        return (
            <div className="p-8 text-slate-500 text-center font-mono text-xs uppercase tracking-widest flex flex-col items-center gap-3">
                <span className="text-2xl opacity-20">📭</span>
                No Files Loaded
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto overflow-x-hidden py-2 custom-scrollbar select-none">
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

            {/* Disclaimer Footer */}
            <div className="px-4 py-8 text-center opacity-30 pointer-events-none">
                <div className="w-8 h-px bg-slate-500 mx-auto mb-2" />
                <span className="text-[10px] font-mono uppercase">End of File Tree</span>
            </div>
        </div>
    );
}
