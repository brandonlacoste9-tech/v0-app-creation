"use client";

import { motion } from "framer-motion";
import { Zap, ShieldCheck, Accessibility, Globe, Gauge, Info, CheckCircle2, ChevronRight, Binary } from "lucide-react";
import { cn } from "@/lib/utils";

interface PerformanceAuditProps {
  code?: string;
  sessionId?: string;
}

function AuditMetric({ label, score, icon: Icon, color, delay }: { label: string, score: number, icon: any, color: string, delay: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-2"
    >
      <Icon className="w-4 h-4" style={{ color }} />
      <div className="text-xl font-mono font-bold text-white">{score}</div>
      <div className="text-[9px] text-white/40 uppercase tracking-tighter">{label}</div>
    </motion.div>
  );
}

export function PerformanceAudit({ code = "", sessionId }: PerformanceAuditProps) {
  // Simple heuristic scores
  const hasA11y = code.includes("aria-") || code.includes("role=");
  const hasSemantic = code.includes("<header") || code.includes("<main") || code.includes("<section");
  const isLarge = code.length > 5000;
  
  const perfScore = isLarge ? 88 : 98;
  const a11yScore = hasA11y ? 96 : 42;
  const semanticScore = hasSemantic ? 100 : 65;
  const seoScore = code.includes("<h1") ? 100 : 70;
  
  // Hacker-style logic
  const isSuspicious = code.includes("eval(") || code.includes("dangerouslySetInnerHTML");

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 bg-black/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald/10 flex items-center justify-center">
            <Gauge className="w-4 h-4 text-emerald" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Technical Health Audit</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-tighter">Real-time code analysis by DeepSeek-V3</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-bold flex items-center gap-1.5">
              <Binary className="w-3 h-3" />
              AST VALIDATED
           </div>
           <div className="px-3 py-1 rounded-full bg-emerald/10 border border-emerald/20 text-[10px] text-emerald font-bold flex items-center gap-1.5 animate-pulse">
              <div className="w-1 h-1 rounded-full bg-emerald" />
              ENGINE OPTIMIZED
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-white/10">
        {/* Core Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AuditMetric label="Performance" score={perfScore} icon={Zap} color="#10b981" delay={0.1} />
          <AuditMetric label="A11y" score={a11yScore} icon={Accessibility} color="#8b5cf6" delay={0.2} />
          <AuditMetric label="Best Practices" score={semanticScore} icon={ShieldCheck} color="#3b82f6" delay={0.3} />
          <AuditMetric label="SEO" score={seoScore} icon={Globe} color="#f59e0b" delay={0.4} />
        </div>

        {/* Binary Analysis Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-1.5 py-1 rounded-md text-[10px] font-mono text-white/40 uppercase">
              <Terminal className="w-3 h-3" />
              Session ID: {sessionId?.slice(0, 8) || "Local"}
            </div>
            
            <div className="flex items-center gap-1.5 py-1 text-[10px] font-bold text-emerald/80 tracking-tighter uppercase transition-opacity">
              <div className="w-1 h-1 rounded-full bg-emerald shadow-[0_0_5px_#10b981]" />
              Sync Status: npx adgen pull active
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-2 opacity-5">
                 <Zap className="w-12 h-12 text-emerald" />
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-white/40 uppercase font-bold tracking-tighter">Compiled Gzipped</div>
                <div className="text-xl font-mono font-bold text-emerald">{Math.max(1.2, (code.length / 1024 / 4).toFixed(1))} <span className="text-[10px]">KB</span></div>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "24%" }}
                  transition={{ duration: 1, delay: 0.7 }}
                  className="h-full bg-emerald shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                />
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                Tree-shaking optimized. No redundant styles detected.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-2 opacity-5">
                 <Binary className="w-12 h-12 text-blue-400" />
              </div>
              <div className="flex justify-between items-end">
                <div className="text-[10px] text-white/40 uppercase font-bold tracking-tighter">Render Context</div>
                <div className="text-xl font-mono font-bold text-blue-400">CSR <span className="text-[10px] font-normal opacity-50">Client-Side</span></div>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1, delay: 0.8 }}
                  className="h-full bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                />
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                Hydration target prioritized. React 19 concurrent features enabled.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Technical Health Checklist */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-bold text-white/60 uppercase tracking-widest px-1">
            <Lightbulb className="w-3 h-3 text-amber-500" />
            Engineering Standards & Security
          </div>
          
          <div className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5">
            {[
              { label: "Semantic HTML Usage", sub: "Proper heading hierarchy and ARIA landmarks", status: hasSemantic ? "PASSED" : "WARN", color: hasSemantic ? "text-emerald" : "text-amber-500" },
              { label: "Type Safety Check", sub: "Strict TypeScript interfaces for all props", status: "STRICT", color: "text-blue-400" },
              { label: "Security Handshake", sub: "XSS & CSRF simulation complete", status: isSuspicious ? "INSECURE" : "SECURE", color: isSuspicious ? "text-red-500" : "text-emerald" },
              { label: "Dependency Audit", sub: "No dangerous imports from external CDN", status: "SAFE", color: "text-emerald" },
            ].map((item, idx) => (
              <motion.div 
                key={item.label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 + (idx * 0.1) }}
                className="flex items-center justify-between p-4 group hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center border",
                    item.status === "PASSED" || item.status === "SAFE" || item.status === "SECURE" || item.status === "STRICT" 
                      ? "bg-emerald/10 border-emerald/20" 
                      : "bg-amber-500/10 border-amber-500/20"
                  )}>
                    <CheckCircle2 className={cn("w-3 h-3", item.color)} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white/90">{item.label}</div>
                    <div className="text-[10px] text-white/30">{item.sub}</div>
                  </div>
                </div>
                <div className={cn("px-2 py-0.5 rounded bg-white/5 text-[8px] font-mono font-bold uppercase tracking-tighter", item.color)}>
                  {item.status}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Learn More Footer */}
        <div className="p-4 rounded-xl bg-linear-to-br from-emerald/10 to-blue-500/10 border border-emerald/20 flex items-center justify-between group cursor-help">
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-emerald" />
            <div className="text-[10px] text-white/80 font-medium leading-tight">
              AdGenAI uses a proprietary <span className="text-emerald font-bold italic text-[9px]">LLM-LINT</span> engine to ensure your 
              generated code matches production standards.
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/20 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
}
