/** Utilities for progressive / streaming code extraction (v0-style live build). */

export type BuildPhase =
  | "idle"
  | "connecting"
  | "planning"
  | "scaffolding"
  | "writing"
  | "styling"
  | "mounting"
  | "done";

export interface StreamCodeState {
  code: string;
  isComplete: boolean;
  hasFence: boolean;
  lineCount: number;
  charCount: number;
}

/** Extract complete or in-progress code from assistant stream text. */
export function extractStreamingCode(text: string): StreamCodeState {
  if (!text) {
    return { code: "", isComplete: false, hasFence: false, lineCount: 0, charCount: 0 };
  }

  const complete = text.match(/```(?:tsx?|jsx?)\r?\n([\s\S]*?)```/);
  if (complete) {
    const code = complete[1].trimEnd();
    return {
      code,
      isComplete: true,
      hasFence: true,
      lineCount: code ? code.split("\n").length : 0,
      charCount: code.length,
    };
  }

  const open = text.match(/```(?:tsx?|jsx?)\r?\n([\s\S]*)$/);
  if (open) {
    const code = open[1];
    return {
      code,
      isComplete: false,
      hasFence: true,
      lineCount: code ? code.split("\n").length : 0,
      charCount: code.length,
    };
  }

  return { code: "", isComplete: false, hasFence: false, lineCount: 0, charCount: 0 };
}

/** Heuristic: enough structure to attempt a live iframe preview. */
export function isLikelyRenderable(code: string): boolean {
  if (code.length < 120) return false;
  const hasDecl =
    /(?:function\s+[A-Z]\w*|const\s+[A-Z]\w*\s*=|export\s+default\s+function)/.test(code) ||
    /(?:function\s+Component|const\s+Component\s*=|function\s+App|const\s+App\s*=)/.test(code);
  const hasJsx = /return\s*[\s\S]*?</.test(code);
  return hasDecl && hasJsx;
}

/** Map stream progress → build phase for UI. */
export function getBuildPhase(
  isGenerating: boolean,
  stream: StreamCodeState,
  hasAnyText: boolean
): BuildPhase {
  if (!isGenerating && stream.isComplete) return "done";
  if (!isGenerating) return "idle";
  if (!hasAnyText && !stream.hasFence) return "connecting";
  if (!stream.hasFence) return "planning";
  if (stream.charCount < 80) return "scaffolding";
  if (stream.charCount < 400) return "writing";
  if (!stream.isComplete) {
    // Tailwind / className heavy → styling phase feel
    if ((stream.code.match(/className=/g) || []).length > 3) return "styling";
    return "writing";
  }
  return "mounting";
}

export const BUILD_STEPS: { id: BuildPhase; label: string; detail: string }[] = [
  { id: "connecting", label: "Connect", detail: "Opening model stream" },
  { id: "planning", label: "Plan", detail: "Structuring layout & components" },
  { id: "scaffolding", label: "Scaffold", detail: "Creating Component.tsx" },
  { id: "writing", label: "Write", detail: "Generating React + hooks" },
  { id: "styling", label: "Style", detail: "Applying Tailwind classes" },
  { id: "mounting", label: "Mount", detail: "Hydrating live preview" },
  { id: "done", label: "Ready", detail: "Preview is live" },
];

/** Steps shown in the chip strip (excludes idle). */
export const VISIBLE_BUILD_STEPS = BUILD_STEPS;

const PHASE_ORDER: BuildPhase[] = [
  "connecting",
  "planning",
  "scaffolding",
  "writing",
  "styling",
  "mounting",
  "done",
];

export function phaseIndex(phase: BuildPhase): number {
  const i = PHASE_ORDER.indexOf(phase);
  return i < 0 ? 0 : i;
}

/** Simulated project files that "appear" as generation progresses. */
export function getVirtualFiles(stream: StreamCodeState, phase: BuildPhase) {
  const files: {
    path: string;
    status: "pending" | "writing" | "done";
    lines?: number;
  }[] = [
    {
      path: "package.json",
      status: phaseIndex(phase) >= phaseIndex("scaffolding") ? "done" : "pending",
    },
    {
      path: "src/Component.tsx",
      status: !stream.hasFence
        ? "pending"
        : stream.isComplete
          ? "done"
          : "writing",
      lines: stream.lineCount || undefined,
    },
    {
      path: "src/index.css",
      status:
        phaseIndex(phase) >= phaseIndex("styling")
          ? stream.isComplete
            ? "done"
            : "writing"
          : phaseIndex(phase) >= phaseIndex("writing")
            ? "pending"
            : "pending",
    },
    {
      path: "tailwind.config.js",
      status: phaseIndex(phase) >= phaseIndex("styling") ? "done" : "pending",
    },
    {
      path: "index.html",
      status: phaseIndex(phase) >= phaseIndex("mounting") ? "done" : "pending",
    },
  ];
  return files;
}
