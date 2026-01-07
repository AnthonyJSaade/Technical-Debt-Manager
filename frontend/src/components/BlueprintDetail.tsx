import type { FileAnalysis } from "../api";

interface BlueprintDetailProps {
    file: FileAnalysis | null;
    onInitiateFix: (file: FileAnalysis) => void;
}

export function BlueprintDetail({ file, onInitiateFix }: BlueprintDetailProps) {
    if (!file) {
        return (
            <div className="h-full flex items-center justify-center text-slate-500 font-mono border-l border-slate-800">
                <div className="text-center">
                    <div className="text-4xl mb-4 opacity-20">⬡</div>
                    <p className="uppercase tracking-widest text-sm">System Ready</p>
                    <p className="text-xs mt-2">Select a module to view schematics</p>
                </div>
            </div>
        );
    }

    const getHealthColor = (val: number) => {
        if (val >= 85) return "text-emerald-400";
        if (val >= 65) return "text-amber-400";
        return "text-red-400";
    };

    return (
        <div className="h-full flex flex-col font-mono text-slate-200 border-l border-slate-800 bg-[#0f172a]">
            {/* Header */}
            <div className="p-6 border-b border-slate-800">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">
                            Component Schematic
                        </div>
                        <h2 className="text-2xl text-cyan-400 font-bold truncate max-w-2xl">
                            {file.file_path.split("/").pop()}
                        </h2>
                        <div className="text-xs text-slate-500 mt-1">{file.file_path}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">
                            System ID
                        </div>
                        <div className="text-sm text-slate-400">
                            #{file.id.toString().padStart(6, "0")}
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => onInitiateFix(file)}
                    className="
            w-full py-3 px-4 
            bg-cyan-500/10 hover:bg-cyan-500/20 
            border border-cyan-500/50 hover:border-cyan-400 
            text-cyan-400 hover:text-cyan-300
            uppercase tracking-widest text-xs font-bold
            transition-all duration-200
            flex items-center justify-center gap-2
          "
                >
                    <span>⚡ Initiate Diagnostics & Repair</span>
                </button>
            </div>

            {/* Content Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                {/* Technical Note (Docstring) */}
                <section>
                    <h3 className="text-xs text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-slate-700 rounded-sm"></span>
                        Technical Description
                    </h3>
                    <div className="bg-[#1e293b] p-4 rounded border border-slate-700/50 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {file.description || (
                            <span className="italic opacity-50 text-slate-500">
                // No technical documentation available.
                                <br />
                // Add module-level docstring to populate.
                            </span>
                        )}
                    </div>
                </section>

                {/* Metrics Grid */}
                <section>
                    <h3 className="text-xs text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-slate-700 rounded-sm"></span>
                        Performance Metrics
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Maintainability Index */}
                        <div className="p-4 bg-[#1e293b] rounded border border-slate-700/50">
                            <div className="text-xs text-slate-500 mb-1">Maintainability</div>
                            <div className={`text-2xl font-bold ${getHealthColor(file.maintainability_index)}`}>
                                {file.maintainability_index.toFixed(0)}
                                <span className="text-sm opacity-50 ml-1">/ 100</span>
                            </div>
                        </div>

                        {/* Cognitive Complexity */}
                        <div className="p-4 bg-[#1e293b] rounded border border-slate-700/50">
                            <div className="text-xs text-slate-500 mb-1">Cognitive Load</div>
                            <div className="text-2xl font-bold text-slate-200">
                                {file.cognitive_complexity}
                                <span className="text-sm opacity-50 ml-1">pts</span>
                            </div>
                        </div>

                        {/* Cyclomatic Complexity */}
                        <div className="p-4 bg-[#1e293b] rounded border border-slate-700/50">
                            <div className="text-xs text-slate-500 mb-1">Cyclomatic Complexity</div>
                            <div className="text-2xl font-bold text-slate-200">
                                {file.complexity_score}
                            </div>
                        </div>

                        {/* Halstead Volume */}
                        <div className="p-4 bg-[#1e293b] rounded border border-slate-700/50">
                            <div className="text-xs text-slate-500 mb-1">Volume (Halstead)</div>
                            <div className="text-2xl font-bold text-slate-200">
                                {file.halstead_volume.toFixed(0)}
                            </div>
                        </div>
                    </div>
                </section>

                {/* File Stats */}
                <section>
                    <h3 className="text-xs text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-slate-700 rounded-sm"></span>
                        Structure Stats
                    </h3>
                    <div className="space-y-2 text-sm text-slate-400">
                        <div className="flex justify-between py-2 border-b border-slate-800">
                            <span>Lines of Code</span>
                            <span className="font-mono text-slate-200">{file.lines_of_code}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-800">
                            <span>AST Node Count</span>
                            <span className="font-mono text-slate-200">{file.node_count}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-800">
                            <span>Est. Tech Debt</span>
                            <span className="font-mono text-slate-200">{file.sqale_debt_hours}h</span>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
