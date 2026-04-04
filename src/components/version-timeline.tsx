"use client";

import { History, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { type CodeVersion } from "@/lib/types";

interface VersionTimelineProps {
  versions: CodeVersion[];
  activeVersionIndex: number;
  onVersionChange: (index: number) => void;
}

export function VersionTimeline({ 
  versions, 
  activeVersionIndex, 
  onVersionChange,
}: VersionTimelineProps) {
  return (
    <div className="flex items-center gap-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 shadow-2xl">
      <div className="flex items-center gap-2 pr-3 border-r border-white/10">
        <History className="w-3.5 h-3.5 text-white/40" />
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">
          Timeline
        </span>
      </div>

      <div className="flex items-center gap-6">
        <button 
          onClick={() => onVersionChange(Math.max(0, activeVersionIndex - 1))}
          disabled={activeVersionIndex === 0}
          className="p-1 rounded-full hover:bg-white/5 disabled:opacity-20 text-white/60 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <div className="flex flex-col gap-1 min-w-[300px] relative group px-2">
          <input 
            type="range"
            min="0"
            max={versions.length - 1}
            step="1"
            value={activeVersionIndex}
            onChange={(e) => onVersionChange(parseInt(e.target.value))}
            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald hover:accent-emerald/80 transition-all outline-none"
            style={{
              background: `linear-gradient(to right, #10b981 ${(activeVersionIndex / (versions.length - 1 || 1)) * 100}%, rgba(255,255,255,0.1) 0%)`
            }}
          />
          
          <div className="flex justify-between w-full px-0.5 pointer-events-none">
            {versions.map((_, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "w-1 h-3 rounded-full transition-all duration-300",
                  idx <= activeVersionIndex ? "bg-emerald/40" : "bg-white/5"
                )} 
              />
            ))}
          </div>

          {/* Active Version Tooltip */}
          <div 
            className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap"
            style={{ 
              left: `${(activeVersionIndex / (versions.length - 1 || 1)) * 100}%`,
              transform: "translateX(-50%)" 
            }}
          >
            <div className="bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 shadow-2xl min-w-[120px]">
              <div className="text-[9px] font-bold text-white/50 uppercase tracking-tighter mb-1 flex items-center justify-between">
                Version {activeVersionIndex + 1}
                <span className="text-emerald text-[8px]">Time Machine</span>
              </div>
              <div className="text-[10px] text-white/90 font-medium line-clamp-1 leading-tight">
                {versions[activeVersionIndex]?.prompt || "Initial synthesis"}
              </div>
            </div>
            <div className="w-1.5 h-1.5 bg-zinc-900 border-r border-b border-white/10 rotate-45 absolute -bottom-0.5 left-1/2 -translate-x-1/2" />
          </div>
        </div>

        <button 
          onClick={() => onVersionChange(Math.min(versions.length - 1, activeVersionIndex + 1))}
          disabled={activeVersionIndex === versions.length - 1}
          className="p-1 rounded-full hover:bg-white/5 disabled:opacity-20 text-white/60 transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="pl-3 border-l border-white/10 flex items-center gap-3">
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-mono text-white/80 leading-none">v{activeVersionIndex + 1}</span>
          <span className="text-[8px] text-white/30 uppercase tracking-widest leading-none mt-0.5">Build</span>
        </div>
      </div>
    </div>
  );
}
