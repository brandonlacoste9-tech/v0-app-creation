"use client";

import { useState, useEffect, useRef } from "react";
import { Terminal, Cpu, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  text: string;
  type: "info" | "success" | "warn" | "error" | "ai";
  timestamp: string;
}

const MOCK_MESSAGES: { text: string; type: LogEntry["type"] }[] = [
  { text: "Initializing DeepSeek-V3 Engine...", type: "info" },
  { text: "MoE Routing: Active (671B parameters)", type: "ai" },
  { text: "Handshake: Antigravity Goggles IDX... SUCCESS", type: "success" },
  { text: "Optimizing Tailwind JIT compiler...", type: "info" },
  { text: "Synthesizing JSX structures...", type: "ai" },
  { text: "Context Window: 128k tokens available", type: "info" },
  { text: "GPU Acceleration: NVIDIA H100 (Sovereign Cloud)", type: "success" },
  { text: "Warning: High temperature detected in synthesis", type: "warn" },
  { text: "Normalizing brand kit tokens...", type: "info" },
  { text: "Syncing with GitHub repository...", type: "info" },
];

export function TerminalLogs({ isGenerating }: { isGenerating: boolean }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isGenerating) {
      const interval = setInterval(() => {
        const msg = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];
        const newLog: LogEntry = {
          id: Math.random().toString(36).substr(2, 9),
          text: msg.text,
          type: msg.type,
          timestamp: new Date().toLocaleTimeString(),
        };
        setLogs((prev) => [...prev.slice(-49), newLog]);
      }, 1200);
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-[10px] font-mono border-t border-border/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/5">
        <div className="flex items-center gap-2 text-emerald/70 uppercase tracking-widest font-bold">
          <Terminal className="w-3 h-3" />
          Engine Console
        </div>
        <div className="flex items-center gap-3 text-[9px] text-white/30 uppercase tracking-tighter">
          <div className="flex items-center gap-1">
            <Cpu className="w-2.5 h-2.5" />
            H100
          </div>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
        {logs.length === 0 && !isGenerating && (
          <div className="flex flex-col items-center justify-center h-full text-white/20 gap-2 opacity-50">
            <Terminal className="w-6 h-6" />
            <p>Waiting for synthesis pulse...</p>
          </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 animate-fadeIn">
            <span className="text-white/20">[{log.timestamp}]</span>
            <span className={cn(
              "font-semibold",
              log.type === "info" && "text-blue-400/80",
              log.type === "success" && "text-emerald-400/80",
              log.type === "warn" && "text-yellow-400/80",
              log.type === "error" && "text-red-400/80",
              log.type === "ai" && "text-emerald-500 font-bold tracking-tight"
            )}>
              {log.type === "ai" && "> "}
              {log.text}
            </span>
          </div>
        ))}
        {isGenerating && (
          <div className="flex gap-2 text-emerald-500 animate-pulse">
            <span className="text-white/20">[{new Date().toLocaleTimeString()}]</span>
            <span>{">"} Executing core synthesis...</span>
          </div>
        )}
        
        {!isGenerating && logs.length > 0 && (
          <div className="mt-4 p-3 rounded-lg border border-emerald/20 bg-emerald/5 animate-in zoom-in-95 duration-500">
            <div className="flex items-center gap-2 mb-2 text-emerald font-bold uppercase tracking-widest text-[9px]">
              <Cpu className="w-3 h-3" />
              Post-Generation Developer Audit
            </div>
            <div className="grid grid-cols-2 gap-4 text-white/50">
              <div className="space-y-1">
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>LCP (Estimated)</span>
                  <span className="text-emerald">0.8s</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Bundle Size</span>
                  <span className="text-emerald">4.2kb</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>A11y Score</span>
                  <span className="text-emerald">98/100</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1">
                  <span>Tailwind Classes</span>
                  <span className="text-emerald">Validated</span>
                </div>
              </div>
            </div>
            <div className="mt-2 text-[8px] text-emerald/60 italic font-mono">
              Engine Note: Code is optimized for Next.js 15 and Tailwind CSS 4.0.
            </div>
          </div>
        )}
      </div>
      
      {/* Bottom status bar */}
      <div className="px-3 py-1 bg-emerald/5 border-t border-emerald/10 flex items-center justify-between text-[9px]">
        <div className="flex items-center gap-2 text-white/40">
           <Database className="w-2.5 h-2.5" />
           REDUX_STATE: SYNCED
        </div>
        <div className="flex items-center gap-2 text-emerald/50">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
          IDE HANDSHAKE ACTIVE
        </div>
      </div>
    </div>
  );
}
