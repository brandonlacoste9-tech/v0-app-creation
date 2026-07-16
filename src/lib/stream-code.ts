/** Progressive / streaming code extraction for live builds. */

import {
  extractStreamingProject,
  getEntryCode,
  mergeForPreview,
  parseProject,
} from "./project-files";

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
  isMulti?: boolean;
  fileCount?: number;
  files?: Record<string, string>;
  entryCode?: string;
}

/** Extract complete or in-progress code/project from assistant stream text. */
export function extractStreamingCode(text: string): StreamCodeState {
  if (!text) {
    return {
      code: "",
      isComplete: false,
      hasFence: false,
      lineCount: 0,
      charCount: 0,
      isMulti: false,
      fileCount: 0,
    };
  }

  const hasFence = /```(?:tsx?|jsx?)/i.test(text);
  const stream = extractStreamingProject(text);
  const fileCount = Object.keys(stream.files).length;

  return {
    code: stream.code,
    isComplete: stream.isComplete,
    hasFence,
    lineCount: stream.lineCount,
    charCount: stream.charCount,
    isMulti: stream.isMulti || fileCount > 1,
    fileCount,
    files: stream.files,
    entryCode: stream.entryCode,
  };
}

/** Code string safe for iframe (merged multi-file). */
export function codeForPreview(storedOrStreamCode: string, entryFallback?: string): string {
  if (entryFallback && !storedOrStreamCode.trim().startsWith("{")) {
    return entryFallback;
  }
  try {
    return mergeForPreview(storedOrStreamCode);
  } catch {
    return getEntryCode(storedOrStreamCode) || storedOrStreamCode;
  }
}

export function isLikelyRenderable(code: string): boolean {
  const src = codeForPreview(code);
  if (src.length < 80) return false;
  const hasDecl =
    /(?:function\s+[A-Z]\w*|const\s+[A-Z]\w*\s*=|function\s+Component|const\s+Component\s*=)/.test(
      src
    );
  const hasJsx = /return\s*[\s\S]*?</.test(src);
  return hasDecl && hasJsx;
}

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
    if (((stream.entryCode || stream.code).match(/className=/g)?.length ?? 0) > 3)
      return "styling";
    return "writing";
  }
  return "mounting";
}

export const BUILD_STEPS: { id: BuildPhase; label: string; detail: string }[] = [
  { id: "connecting", label: "Connect", detail: "Opening model stream" },
  { id: "planning", label: "Plan", detail: "Structuring layout & components" },
  { id: "scaffolding", label: "Scaffold", detail: "Creating project files" },
  { id: "writing", label: "Write", detail: "Generating React + hooks" },
  { id: "styling", label: "Style", detail: "Applying Tailwind classes" },
  { id: "mounting", label: "Mount", detail: "Hydrating live preview" },
  { id: "done", label: "Ready", detail: "Preview is live" },
];

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

export function getVirtualFiles(stream: StreamCodeState, phase: BuildPhase) {
  const realFiles = stream.files ? Object.keys(stream.files) : [];
  if (realFiles.length > 0) {
    return realFiles.map((path) => ({
      path,
      status: (stream.isComplete ? "done" : "writing") as "pending" | "writing" | "done",
      lines: stream.files?.[path]?.split("\n").length,
    }));
  }

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
      status: !stream.hasFence ? "pending" : stream.isComplete ? "done" : "writing",
      lines: stream.lineCount || undefined,
    },
    {
      path: "src/index.css",
      status:
        phaseIndex(phase) >= phaseIndex("styling")
          ? stream.isComplete
            ? "done"
            : "writing"
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

export { parseProject, mergeForPreview, getEntryCode };
