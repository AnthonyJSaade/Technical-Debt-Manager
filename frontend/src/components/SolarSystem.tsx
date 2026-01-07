import { useMemo, useRef, useCallback } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import type { FileAnalysis } from "../api";

interface SolarSystemProps {
    files: FileAnalysis[];
    onNodeClick: (file: FileAnalysis) => void;
}

interface GraphNode {
    id: string;
    name: string;
    val: number; // size
    color: string;
    type: "folder" | "file";
    fileData?: FileAnalysis;
    x?: number;
    y?: number;
}

interface GraphLink {
    source: string;
    target: string;
    color: string;
    distance?: number;
}

// Color Palette (Space Theme)
const COLORS = {
    background: "#050B14",     // Deep Space
    folderSun: "#FDB813",      // Sun Gold
    filePlanet: "#60A5FA",     // Planet Blue
    link: "#1e3a5f",           // Faint Orbit

    // Health Colors
    healthHigh: "#34D399",     // Emerald (Healthy)
    healthMed: "#FBBF24",      // Amber (Warning)
    healthLow: "#F87171",      // Red (Critical)
};

function getHealthColor(mi: number): string {
    if (mi >= 85) return COLORS.healthHigh;
    if (mi >= 65) return COLORS.healthMed;
    return COLORS.healthLow;
}

export function SolarSystem({ files, onNodeClick }: SolarSystemProps) {
    const fgRef = useRef<ForceGraphMethods | undefined>(undefined);

    // Transform flat file list into Graph Data (Nodes + Links)
    const graphData = useMemo(() => {
        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];
        const folderSet = new Set<string>();

        // 1. Create File Nodes (Planets)
        files.forEach((file) => {
            // Calculate Size based on Complexity (Logarithmic scale)
            // Base size 3, max size 15
            const size = Math.max(3, Math.min(15, Math.log2(file.complexity_score + 1) * 2));

            nodes.push({
                id: file.file_path,
                name: file.file_path.split("/").pop() || "unknown",
                val: size,
                color: getHealthColor(file.maintainability_index),
                type: "file",
                fileData: file,
            });

            // Identify Parent Folder
            const parts = file.file_path.split("/");
            const folderPath = parts.slice(0, -1).join("/") || "root";
            folderSet.add(folderPath);
        });

        // 2. Create Folder Nodes (Suns)
        folderSet.forEach((folderPath) => {
            // Root folder is the center of the universe
            const isRoot = folderPath === "root" || folderPath === "";

            nodes.push({
                id: folderPath,
                name: folderPath.split("/").pop() || "ROOT",
                val: isRoot ? 20 : 8, // Suns are big
                color: COLORS.folderSun,
                type: "folder",
            });
        });

        // 3. Link Files to their Folders (Gravity)
        files.forEach((file) => {
            const parts = file.file_path.split("/");
            const folderPath = parts.slice(0, -1).join("/") || "root";

            links.push({
                source: folderPath,
                target: file.file_path,
                color: COLORS.link,
            });
        });

        // 4. Link Folders to Parent Folders (Hierarchical Gravity)
        folderSet.forEach((folderPath) => {
            if (folderPath === "root" || folderPath === "") return;

            const parts = folderPath.split("/");
            const parentPath = parts.slice(0, -1).join("/") || "root";

            // Only link if parent exists (it should, if we built the set right, but be safe)
            if (folderSet.has(parentPath) || parentPath === "root") {
                links.push({
                    source: parentPath,
                    target: folderPath,
                    color: "#60A5FA40", // Folder-folder links are stronger/visible
                });
            }
        });

        return { nodes, links };
    }, [files]);

    const handleNodeClick = useCallback((node: GraphNode) => {
        if (node.type === "file" && node.fileData) {
            // Zoom to node on click
            fgRef.current?.centerAt(node.x, node.y, 1000);
            fgRef.current?.zoom(4, 2000);
            onNodeClick(node.fileData);
        }
    }, [onNodeClick]);

    return (
        <div className="relative w-full h-full bg-[#050B14] overflow-hidden rounded-lg border border-slate-800 shadow-2xl">
            {/* Overlay HUD */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <h2 className="text-xl font-bold text-slate-200 tracking-widest font-mono">
                    SOLAR SYSTEM MAP
                </h2>
                <div className="flex items-center gap-4 mt-2 text-xs font-mono text-slate-500">
                    <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-[#FDB813]"></span> Folder (Sun)
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-[#34D399]"></span> Healthy
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full bg-[#F87171]"></span> Critical
                    </div>
                </div>
            </div>

            <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                backgroundColor={COLORS.background}
                nodeLabel="name"
                nodeRelSize={1} // Use exact 'val' for radius

                // Link Style
                linkColor={() => COLORS.link}
                linkWidth={1}
                linkDirectionalParticles={2} // Flowing particles
                linkDirectionalParticleWidth={2}
                linkDirectionalParticleSpeed={0.005}

                // Interaction
                onNodeClick={handleNodeClick as any}

                // Custom Node Painting (optional canvas drawing)
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                    const label = node.name;
                    const fontSize = 12 / globalScale;
                    const radius = node.val;

                    // Draw Body
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
                    ctx.fillStyle = node.color;
                    ctx.fill();

                    // Glow Effect for Suns
                    if (node.type === "folder") {
                        ctx.shadowBlur = 15;
                        ctx.shadowColor = node.color;
                    } else {
                        ctx.shadowBlur = 0;
                    }

                    // Draw Label (only if zoomed in or large node)
                    if (globalScale > 1.5 || node.type === "folder") {
                        ctx.font = `${fontSize}px Sans-Serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                        // Draw below the node
                        ctx.fillText(label, node.x, node.y + radius + fontSize);
                    }
                }}

                // Physics Engine Config
                d3AlphaDecay={0.02} // Slower decay = longer settling
                d3VelocityDecay={0.3} // Medium friction
                cooldownTicks={1000}
            />
        </div>
    );
}
