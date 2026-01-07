import { useMemo, useState } from "react";
import { hierarchy, tree } from "d3-hierarchy";
import { linkVertical } from "d3-shape";
import type { FileAnalysis, FileIssue } from "../api";

interface StaticNetworkProps {
    files: FileAnalysis[];
    issues?: FileIssue[];
    onFileClick?: (file: FileAnalysis) => void;
}

interface TreeNode {
    name: string;
    type: "file" | "folder";
    fileData?: FileAnalysis;
    children?: TreeNode[];
}

const SVG_HEIGHT = 800;
const SVG_WIDTH = 1200;

function getCommonPrefix(paths: string[]): string {
    if (paths.length === 0) return "";
    let prefix = paths[0];
    for (let i = 1; i < paths.length; i++) {
        while (paths[i].indexOf(prefix) !== 0) {
            prefix = prefix.substring(0, prefix.length - 1);
            if (prefix === "") return "";
        }
    }
    return prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
}

export function StaticNetwork({ files, issues = [], onFileClick }: StaticNetworkProps) {
    const [hoveredFile, setHoveredFile] = useState<FileAnalysis | null>(null);

    const { root, links } = useMemo(() => {
        if (files.length === 0) return { root: null, links: [] };

        // 1. Determine Root Context
        const allPaths = files.map(f => f.file_path);
        const commonPrefix = getCommonPrefix(allPaths);

        const parts = commonPrefix.split("/");
        const scannedFolderName = parts.pop() || "Project";
        const parentFolderName = parts.pop() || "Root";

        const dataRoot: TreeNode = { name: parentFolderName, type: "folder", children: [] };

        // Create the Scanned Folder Node
        const scannedNode: TreeNode = { name: scannedFolderName, type: "folder", children: [] };
        dataRoot.children?.push(scannedNode);

        const map = new Map<string, TreeNode>();
        map.set("", scannedNode);

        files.forEach((f) => {
            const relativePath = f.file_path.substring(commonPrefix.length);
            const PathParts = relativePath.split("/").filter(Boolean);

            let currentPath = "";

            PathParts.forEach((part, index) => {
                const isFile = index === PathParts.length - 1;
                const parentPath = currentPath;
                currentPath = currentPath ? `${currentPath}/${part}` : part;

                if (!map.has(currentPath)) {
                    const newNode: TreeNode = {
                        name: part,
                        type: isFile ? "file" : "folder",
                        fileData: isFile ? f : undefined,
                        children: isFile ? undefined : [],
                    };
                    map.set(currentPath, newNode);

                    const parent = map.get(parentPath);
                    if (parent && parent.children) {
                        parent.children.push(newNode);
                    }
                }
            });
        });

        // 2. D3 Tree
        const d3Root = hierarchy<TreeNode>(dataRoot);
        d3Root.sort((a, b) => (a.data.name || "").localeCompare(b.data.name || ""));

        const treeLayout = tree<TreeNode>().size([SVG_WIDTH - 150, SVG_HEIGHT - 100]);
        treeLayout(d3Root);

        return { root: d3Root, links: d3Root.links() };
    }, [files]);

    if (!root) return <div className="p-8 text-center text-gray-500">No data to display</div>;

    const linkGen = linkVertical()
        .x((d: any) => d.x)
        .y((d: any) => d.y);

    return (
        <div className="relative h-[600px] border border-slate-700 bg-[#0a0f1a] rounded-lg overflow-hidden shadow-xl">

            {/* Description Overlay */}
            {hoveredFile && (
                <div className="absolute top-4 right-4 z-10 w-80 bg-slate-900/90 backdrop-blur border border-slate-700 p-4 rounded-lg shadow-2xl animate-fade-in pointer-events-none">
                    <h4 className="text-cyan-400 font-bold font-mono text-sm mb-1 break-all">
                        {hoveredFile.file_path.split("/").pop()}
                    </h4>

                    {/* Description / Docstring */}
                    {hoveredFile.description ? (
                        <p className="text-sm text-slate-200 leading-relaxed border-l-2 border-cyan-500 pl-3">
                            {hoveredFile.description}
                        </p>
                    ) : (
                        <p className="text-xs text-slate-600 italic">
                            No technical note available for this component.
                        </p>
                    )}

                    {/* Grid: Health, Bugs, Complexity */}
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-800">
                        <div>
                            <span className="text-[10px] uppercase text-slate-500">Health</span>
                            <div className="text-emerald-400 font-mono">{Math.round(hoveredFile.maintainability_index)}%</div>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase text-slate-500">Bugs</span>
                            <div className="text-red-400 font-mono font-bold">
                                {issues.filter(i => i.file_path === hoveredFile.file_path).length}
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] uppercase text-slate-500">Complexity</span>
                            <div className="text-amber-400 font-mono">{hoveredFile.complexity_score}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Map */}
            <div className="h-full overflow-auto bg-[url('/grid.svg')] flex items-center justify-center">
                <div className="min-w-max min-h-max p-12 pt-20">
                    <svg width={SVG_WIDTH} height={SVG_HEIGHT} className="overflow-visible">
                        <g transform="translate(50, 40)">
                            {/* Links */}
                            {links.map((link, i) => (
                                <path
                                    key={i}
                                    d={linkGen(link as any) || undefined}
                                    fill="none"
                                    stroke="#1e3a5f"
                                    strokeWidth="1.5"
                                    className="opacity-40"
                                />
                            ))}

                            {/* Nodes */}
                            {root.descendants().map((node, i) => {
                                const isFile = node.data.type === "file";
                                const isRoot = node.depth === 0;

                                // Bigger sizes: 30-70px for files (Increased from 20-50)
                                const size = isFile
                                    ? Math.max(30, Math.min(70, Math.log2((node.data.fileData?.complexity_score || 0) + 1) * 10))
                                    : (isRoot ? 60 : 45);

                                const isHovered = hoveredFile && hoveredFile.file_path === node.data.fileData?.file_path;

                                return (
                                    <g
                                        key={i}
                                        transform={`translate(${node.x},${node.y})`}
                                        className="cursor-pointer transition-opacity duration-300"
                                        style={{ opacity: hoveredFile && !isHovered && !isFile ? 0.3 : 1 }}
                                        onClick={() => {
                                            if (isFile && node.data.fileData && onFileClick) {
                                                onFileClick(node.data.fileData);
                                            }
                                        }}
                                        onMouseEnter={() => isFile && node.data.fileData && setHoveredFile(node.data.fileData)}
                                        onMouseLeave={() => setHoveredFile(null)}
                                    >
                                        {/* Hover Ring */}
                                        {isHovered && (
                                            <circle r={size / 2 + 6} fill="none" stroke="#22d3ee" strokeWidth="2" className="animate-ping opacity-50" />
                                        )}

                                        {/* Node Shape */}
                                        <circle
                                            r={size / 2}
                                            fill={isFile ? "#0f172a" : (isRoot ? "#b45309" : "#ca8a04")}
                                            stroke={isFile ? getHealthColor(node.data.fileData?.maintainability_index || 100) : (isRoot ? "#d97706" : "#ca8a04")}
                                            strokeWidth={isFile ? (isHovered ? 3 : 2) : (isRoot ? 3 : 0)}
                                            className="transition-all duration-200"
                                            style={{
                                                filter: isHovered ? "drop-shadow(0 0 8px cyan)" : "none"
                                            }}
                                        />

                                        {/* Label */}
                                        <text
                                            dy={size / 2 + 18}
                                            textAnchor="middle"
                                            className={`text-[10px] font-mono tracking-wider transition-colors duration-200
                                        ${isFile ? (isHovered ? 'fill-cyan-400 font-bold' : 'fill-slate-500') : (isRoot ? 'fill-amber-500 font-bold uppercase text-xs' : 'fill-amber-500/80 font-bold')}
                                      `}
                                        >
                                            {node.data.name}
                                        </text>

                                        {/* Icon */}
                                        {isFile ? (
                                            <text dy="5" textAnchor="middle" fontSize={size / 2.2} className="fill-slate-600 pointer-events-none select-none">
                                                📄
                                            </text>
                                        ) : (
                                            <text dy="6" textAnchor="middle" fontSize={isRoot ? "22" : "18"} className="fill-black pointer-events-none select-none">
                                                {isRoot ? "🏗️" : "📂"}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    </svg>
                </div>
            </div>
        </div>
    );
}

function getHealthColor(mi: number) {
    if (mi >= 85) return "#34d399";
    if (mi >= 65) return "#fcd34d";
    return "#f87171";
}
