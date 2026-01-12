import { useMemo, useState, useEffect, useRef } from "react";
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

const SVG_HEIGHT = 800; // Fixed height
// SVG_WIDTH will be dynamic based on container

// Premium Color Palette
const NODE_COLORS = {
    file: "#0f172a",       // Slate 900
    folder: "#f59e0b",     // Amber 500
    root: "#d97706",       // Amber 600
    strokeDefault: "#334155", // Slate 700
    link: "#1e293b",       // Slate 800
};

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
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 1200, height: SVG_HEIGHT });

    // Handle responsive width
    useEffect(() => {
        if (containerRef.current) {
            setDimensions({
                width: Math.max(1200, containerRef.current.clientWidth),
                height: SVG_HEIGHT
            });
        }

        const handleResize = () => {
            if (containerRef.current) {
                setDimensions({
                    width: Math.max(1200, containerRef.current.clientWidth),
                    height: SVG_HEIGHT
                });
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Scroll to bottom on mount (show leaf files first)
    useEffect(() => {
        if (scrollContainerRef.current && files.length > 0) {
            // Small delay to ensure content is rendered
            requestAnimationFrame(() => {
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                }
            });
        }
    }, [files.length]);


    const { root, links } = useMemo(() => {
        if (files.length === 0) return { root: null, links: [] };

        const allPaths = files.map(f => f.file_path);
        const commonPrefix = getCommonPrefix(allPaths);

        const parts = commonPrefix.split("/");
        const scannedFolderName = parts.pop() || "Project";
        const parentFolderName = parts.pop() || "Root";

        const dataRoot: TreeNode = { name: parentFolderName, type: "folder", children: [] };
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

        const d3Root = hierarchy<TreeNode>(dataRoot);
        d3Root.sort((a, b) => (a.data.name || "").localeCompare(b.data.name || ""));

        // Use dynamic width for layout
        const treeLayout = tree<TreeNode>().size([dimensions.width - 200, SVG_HEIGHT - 150]);
        treeLayout(d3Root);

        // Reposition root to actual center
        d3Root.each(d => {
            // @ts-ignore
            d.x += 50;
        })

        return { root: d3Root, links: d3Root.links() };
    }, [files, dimensions.width]);

    if (!root) return <div className="p-8 text-center text-slate-500 font-light">Loading visualization...</div>;

    const linkGen = linkVertical<unknown, { x: number; y: number }>()
        .x((d) => d.x)
        .y((d) => d.y);

    return (
        <div ref={containerRef} className="relative h-[600px] bg-[#020617] overflow-hidden">

            {/* Detailed Glass Overlay */}
            {hoveredFile && (
                <div className="absolute top-6 right-6 z-20 w-80 glass-panel p-5 rounded-xl shadow-2xl animate-fade-in-up pointer-events-none border-l-4 border-l-cyan-500">
                    <h4 className="text-cyan-400 font-bold font-mono text-base mb-1 break-all flex items-center gap-2">
                        <span className="text-2xl">📄</span> {hoveredFile.file_path.split("/").pop()}
                    </h4>

                    {/* Description */}
                    <div className="my-4 text-sm text-slate-300 leading-relaxed font-light">
                        {hoveredFile.description || <span className="italic text-slate-500">No description available.</span>}
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
                        <div className="text-center p-2 rounded bg-white/5 backdrop-blur-sm">
                            <span className="text-[10px] uppercase text-emerald-400 font-bold tracking-wider block mb-1">Health</span>
                            <div className="text-white font-mono text-xl">{Math.round(hoveredFile.maintainability_index)}%</div>
                        </div>
                        <div className="text-center p-2 rounded bg-white/5 backdrop-blur-sm">
                            <span className="text-[10px] uppercase text-red-400 font-bold tracking-wider block mb-1">Bugs</span>
                            <div className="text-white font-mono text-xl font-bold">
                                {issues.filter(i => i.file_path === hoveredFile.file_path).length}
                            </div>
                        </div>
                        <div className="text-center p-2 rounded bg-white/5 backdrop-blur-sm">
                            <span className="text-[10px] uppercase text-amber-400 font-bold tracking-wider block mb-1">Nodes</span>
                            <div className="text-white font-mono text-xl">{hoveredFile.node_count}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Interactive Map */}
            <div ref={scrollContainerRef} className="h-full overflow-auto flex items-center justify-center custom-scrollbar cursor-grab active:cursor-grabbing bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-[#020617] to-[#020617]">
                <div className="min-w-max min-h-max p-8 pt-12">
                    <svg width={dimensions.width} height={SVG_HEIGHT} className="overflow-visible">

                        {/* Defs for Gradients */}
                        <defs>
                            <radialGradient id="glowGradient">
                                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                            </radialGradient>
                            <radialGradient id="folderGradient">
                                <stop offset="0%" stopColor="#f59e0b" />
                                <stop offset="100%" stopColor="#d97706" />
                            </radialGradient>
                        </defs>

                        <g transform="translate(0, 40)">
                            {/* Connection Links */}
                            {links.map((link, i) => (
                                <path
                                    key={i}
                                    d={linkGen(link as any) || undefined}
                                    fill="none"
                                    stroke={NODE_COLORS.link}
                                    strokeWidth="2"  // Thicker links
                                    className="opacity-40 transition-all duration-500"
                                />
                            ))}

                            {/* Nodes */}
                            {root.descendants().map((node, i) => {
                                const isFile = node.data.type === "file";
                                const isRoot = node.depth === 0;

                                // Size Logic - INCREASED SIGNIFICANTLY
                                // Base size 35px, scaling up to 90px
                                const size = isFile
                                    ? Math.max(35, Math.min(90, Math.log2((node.data.fileData?.complexity_score || 0) + 1) * 12))
                                    : (isRoot ? 70 : 55);

                                const isHovered = hoveredFile && hoveredFile.file_path === node.data.fileData?.file_path; // Only exact match for now to simplify

                                return (
                                    <g
                                        key={i}
                                        transform={`translate(${node.x},${node.y})`}
                                        className="transition-all duration-500 ease-out"
                                        style={{
                                            opacity: hoveredFile && !isHovered && !isFile ? 0.2 : 1,
                                            transform: isHovered ? `translate(${node.x}px, ${node.y}px) scale(1.15)` : `translate(${node.x}px, ${node.y}px) scale(1)`
                                        }}
                                        onClick={() => {
                                            if (isFile && node.data.fileData && onFileClick) {
                                                onFileClick(node.data.fileData);
                                            }
                                        }}
                                        onMouseEnter={() => {
                                            if (isFile && node.data.fileData) setHoveredFile(node.data.fileData);
                                        }}
                                        onMouseLeave={() => setHoveredFile(null)}
                                    >
                                        {/* Glow Ring on Hover */}
                                        {isHovered && (
                                            <>
                                                <circle r={size / 2 + 20} fill="url(#glowGradient)" className="animate-pulse-subtle" />
                                                <circle r={size / 2 + 6} fill="none" stroke="#22d3ee" strokeWidth="2" />
                                            </>
                                        )}

                                        {/* Main Node Circle */}
                                        <circle
                                            r={size / 2}
                                            fill={isFile ? NODE_COLORS.file : "url(#folderGradient)"}
                                            stroke={isFile ? getHealthColor(node.data.fileData?.maintainability_index || 100) : "rgba(255,255,255,0.2)"}
                                            strokeWidth={isFile ? 3 : 0} // Thicker stroke
                                            className={`
                                        transition-all duration-300
                                        ${isFile ? 'cursor-pointer drop-shadow-lg' : 'drop-shadow-md'}
                                      `}
                                        />

                                        {/* Label Text - LARGER */}
                                        <text
                                            dy={size / 2 + 24} // Push text down further
                                            textAnchor="middle"
                                            className={`font-mono tracking-wide transition-all duration-200 select-none
                                        ${isFile
                                                    ? (isHovered ? 'fill-cyan-300 font-bold text-sm' : 'fill-slate-400 text-xs font-medium')
                                                    : (isRoot ? 'fill-amber-500 font-bold uppercase text-sm' : 'fill-slate-500 font-bold text-xs')}
                                      `}
                                            style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
                                        >
                                            {node.data.name}
                                        </text>

                                        {/* Center Icon */}
                                        {isFile ? (
                                            <text dy="5" textAnchor="middle" fontSize={size / 2.2} className="fill-slate-500 pointer-events-none select-none opacity-60">
                                                📄
                                            </text>
                                        ) : (
                                            <text dy="6" textAnchor="middle" fontSize={isRoot ? "28" : "22"} className="pointer-events-none select-none filter opacity-90 drop-shadow-md">
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
    if (mi >= 85) return "#34d399"; // Emerald 400
    if (mi >= 65) return "#fcd34d"; // Amber 300
    return "#f87171"; // Red 400
}
