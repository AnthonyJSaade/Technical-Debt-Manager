/**
 * HealthHUD Component
 *
 * Executive Dashboard with circular gauge metrics:
 * - System Health (Maintainability Index)
 * - Technical Debt (SQALE Hours)
 * - Cognitive Load (Average Complexity)
 */

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { FileAnalysis } from "../api";

interface HealthHUDProps {
  files: FileAnalysis[];
  isLoading: boolean;
}

interface GaugeProps {
  value: number;
  maxValue: number;
  label: string;
  sublabel: string;
  displayValue: string;
  color: string;
  glowColor: string;
  icon: string;
}

function CircularGauge({ 
  value, 
  maxValue, 
  label, 
  sublabel, 
  displayValue, 
  color, 
  glowColor, 
  icon 
}: GaugeProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);
  const data = [
    { value: percentage },
    { value: 100 - percentage },
  ];

  return (
    <div className="relative flex flex-col items-center">
      {/* Glow effect */}
      <div 
        className="absolute inset-0 blur-2xl opacity-30 rounded-full"
        style={{ background: glowColor }}
      />
      
      {/* Gauge */}
      <div className="relative w-40 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* Background ring */}
            <Pie
              data={[{ value: 100 }]}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={65}
              dataKey="value"
              stroke="none"
            >
              <Cell fill="#1f2937" />
            </Pie>
            {/* Value ring */}
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={65}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill="transparent" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl mb-1">{icon}</span>
          <span className="text-xl font-bold text-white">
            {displayValue}
          </span>
        </div>
      </div>

      {/* Labels */}
      <div className="mt-3 text-center">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-gray-500">{sublabel}</p>
      </div>
    </div>
  );
}

function SkeletonGauge() {
  return (
    <div className="flex flex-col items-center animate-pulse">
      <div className="w-40 h-40 rounded-full bg-gray-800/50" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-20 bg-gray-800 rounded mx-auto" />
        <div className="h-3 w-16 bg-gray-800/50 rounded mx-auto" />
      </div>
    </div>
  );
}

export function HealthHUD({ files, isLoading }: HealthHUDProps) {
  // Calculate metrics
  const totalFiles = files.length;
  
  // Average Maintainability Index (0-100, higher is better)
  const avgMI = totalFiles > 0 
    ? files.reduce((sum, f) => sum + f.maintainability_index, 0) / totalFiles 
    : 100;
  
  // Total SQALE Debt (hours)
  const totalDebtHours = files.reduce((sum, f) => sum + f.sqale_debt_hours, 0);
  
  // Average Cognitive Complexity
  const avgCognitiveComplexity = totalFiles > 0 
    ? files.reduce((sum, f) => sum + f.cognitive_complexity, 0) / totalFiles 
    : 0;
  
  // Total Lines of Code
  const totalLOC = files.reduce((sum, f) => sum + f.lines_of_code, 0);

  // Determine colors based on Maintainability Index
  const getMIColor = (mi: number) => {
    if (mi >= 80) return { color: "#10b981", glow: "radial-gradient(circle, #10b981 0%, transparent 70%)" };
    if (mi >= 50) return { color: "#f59e0b", glow: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" };
    return { color: "#ef4444", glow: "radial-gradient(circle, #ef4444 0%, transparent 70%)" };
  };

  // Debt colors (inverted - lower is better)
  const getDebtColor = (hours: number) => {
    if (hours <= 2) return { color: "#10b981", glow: "radial-gradient(circle, #10b981 0%, transparent 70%)" };
    if (hours <= 8) return { color: "#f59e0b", glow: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" };
    return { color: "#ef4444", glow: "radial-gradient(circle, #ef4444 0%, transparent 70%)" };
  };

  // Cognitive Complexity colors
  const getCCColor = (cc: number) => {
    if (cc < 5) return { color: "#10b981", glow: "radial-gradient(circle, #10b981 0%, transparent 70%)" };
    if (cc < 15) return { color: "#f59e0b", glow: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" };
    return { color: "#ef4444", glow: "radial-gradient(circle, #ef4444 0%, transparent 70%)" };
  };

  const miColors = getMIColor(avgMI);
  const debtColors = getDebtColor(totalDebtHours);
  const ccColors = getCCColor(avgCognitiveComplexity);

  // Format debt hours nicely
  const formatDebtHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 10) return `${hours.toFixed(1)}h`;
    return `${Math.round(hours)}h`;
  };

  // Get health status text
  const getHealthStatus = (mi: number) => {
    if (mi >= 85) return "Excellent";
    if (mi >= 70) return "Good";
    if (mi >= 50) return "Moderate";
    if (mi >= 30) return "Poor";
    return "Critical";
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 border border-gray-800 rounded-2xl p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-items-center">
          <SkeletonGauge />
          <SkeletonGauge />
          <SkeletonGauge />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-900/80 to-[#0a0f1a] border border-cyan-900/30 rounded-2xl p-8 shadow-xl shadow-cyan-950/20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-items-center">
        {/* System Health (Maintainability Index) */}
        <CircularGauge
          value={avgMI}
          maxValue={100}
          label="System Health"
          sublabel={getHealthStatus(avgMI)}
          displayValue={`${Math.round(avgMI)}%`}
          color={miColors.color}
          glowColor={miColors.glow}
          icon="🏥"
        />

        {/* Technical Debt (SQALE Hours) */}
        <CircularGauge
          value={Math.min(totalDebtHours, 40)}
          maxValue={40}
          label="Technical Debt"
          sublabel="Est. Remediation Time"
          displayValue={formatDebtHours(totalDebtHours)}
          color={debtColors.color}
          glowColor={debtColors.glow}
          icon="⏱️"
        />

        {/* Cognitive Load */}
        <CircularGauge
          value={Math.min(avgCognitiveComplexity, 30)}
          maxValue={30}
          label="Cognitive Load"
          sublabel="Avg Nesting Depth"
          displayValue={avgCognitiveComplexity.toFixed(1)}
          color={ccColors.color}
          glowColor={ccColors.glow}
          icon="🧠"
        />
      </div>

      {/* Stats bar */}
      <div className="mt-8 pt-6 border-t border-gray-800/50 grid grid-cols-4 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-white">{totalFiles}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Files</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{totalLOC.toLocaleString()}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Lines of Code</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{avgMI.toFixed(0)}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Avg MI</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{formatDebtHours(totalDebtHours)}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Debt</p>
        </div>
      </div>

      {/* Insight Banner */}
      {totalFiles > 0 && totalDebtHours > 0 && (
        <div className="mt-4 p-3 bg-cyan-950/30 border border-cyan-900/30 rounded-lg">
          <p className="text-sm text-cyan-300 text-center">
            💡 Your project is <span className="font-bold">{Math.round(avgMI)}% healthy</span>
            {totalDebtHours > 0 && (
              <>, but will take <span className="font-bold text-amber-400">{formatDebtHours(totalDebtHours)}</span> to remediate complexity issues</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
