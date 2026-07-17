"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CodeVersion, UserInfo } from "@/lib/types";
import { PREVIEW_THEMES } from "@/lib/types";
import { wrapCodeForPreview } from "@/lib/preview-html";
import type { StreamCodeState } from "@/lib/stream-code";
import {
  getEntryCode,
  listProjectFiles,
  parseProject,
  serializeProject,
} from "@/lib/project-files";
import { BuildView } from "@/components/build-view";
import {
  Monitor,
  Tablet,
  Smartphone,
  Code2,
  Copy,
  Check,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Layers,
  ZoomIn,
  ZoomOut,
  Download,
  FileCode,
  Pencil,
  Eye,
  Rocket,
  ChevronDown,
  Maximize2,
  Minimize2,
  Box,
  Split,
  Terminal as TerminalIcon,
  Hash,
  Columns,
  Command,
  Link2,
  Upload,
} from "lucide-react";
import { GithubIcon } from "@/components/icons";
import { TerminalLogs } from "@/components/terminal-logs";
import { LayoutPanelLeft, Gauge } from "lucide-react";
import { PerformanceAudit } from "@/components/performance-audit";
import { VersionTimeline } from "@/components/version-timeline";
import Editor from "@monaco-editor/react";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "preview" | "code" | "edit" | "audit";
type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

interface PreviewPanelProps {
  versions: CodeVersion[];
  activeVersionIndex: number;
  onVersionChange: (index: number) => void;
  isGenerating: boolean;
  /** Live stream payload for the build view */
  streamText?: string;
  streamCode?: StreamCodeState;
  onPushToGitHub?: () => void;
  onDeploy?: () => void;
  onDownloadZip?: () => void;
  onDownloadHtml?: () => void;
  onCodeEdit?: (versionId: string, code: string) => void;
  onRestoreVersion?: (index: number) => void;
  onShareToCodeSandbox?: () => void;
  onShareLink?: () => void;
  shareLinkCopied?: boolean;
  onPublish?: () => void;
  publishBusy?: boolean;
  previewTheme: string;
  onPreviewThemeChange: (themeId: string) => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  userInfo?: UserInfo | null;
  onUpgrade?: () => void;
  initialTab?: "preview" | "code";
}

export function PreviewPanel({
  versions,
  activeVersionIndex,
  onVersionChange,
  isGenerating,
  streamText = "",
  streamCode,
  onPushToGitHub,
  onDeploy,
  onDownloadZip,
  onDownloadHtml,
  onCodeEdit,
  onRestoreVersion,
  onShareToCodeSandbox,
  onShareLink,
  shareLinkCopied = false,
  onPublish,
  publishBusy = false,
  previewTheme,
  onPreviewThemeChange,
  fullscreen = false,
  onToggleFullscreen,
  userInfo,
  onUpgrade,
  initialTab,
}: PreviewPanelProps) {
  const [isDuelView, setIsDuelView] = useState(false);
  const nextVersionCode = useMemo(() => {
    if (isGenerating) return "Generating evolution...";
    if (versions.length > 1) return versions[versions.length - 2].code;
    return null;
  }, [isGenerating, versions]);

  const activeVersion = versions[activeVersionIndex];
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "preview");
  const [copied, setCopied] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [zoom, setZoom] = useState(100);
  const [iframeKey, setIframeKey] = useState(0);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [editCode, setEditCode] = useState(activeVersion?.code || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isDevCenterOpen, setIsDevCenterOpen] = useState(false);
  const [mockProps, setMockProps] = useState('{\n  "title": "Welcome to AdGenAI",\n  "status": "Online"\n}');
  
  const [prevVersionId, setPrevVersionId] = useState(activeVersion?.id);
  if (activeVersion?.id !== prevVersionId) {
    setPrevVersionId(activeVersion?.id);
    if (!isEditing) {
      setEditCode(activeVersion?.code || "");
    }
  }


  const themeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!themeDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(e.target as Node)) {
        setThemeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [themeDropdownOpen]);

  const currentTheme = PREVIEW_THEMES.find((t) => t.id === previewTheme) ?? PREVIEW_THEMES[0];

  // When a build starts, jump to Preview tab so the live build is visible
  useEffect(() => {
    if (isGenerating) setActiveTab("preview");
  }, [isGenerating]);

  const projectFiles = useMemo(
    () => (activeVersion ? listProjectFiles(activeVersion.code) : []),
    [activeVersion]
  );
  const projectMeta = useMemo(
    () => (activeVersion ? parseProject(activeVersion.code) : null),
    [activeVersion]
  );
  const [selectedFilePath, setSelectedFilePath] = useState("src/Component.tsx");

  useEffect(() => {
    if (projectMeta?.entry) setSelectedFilePath(projectMeta.entry);
    else if (projectFiles[0]) setSelectedFilePath(projectFiles[0].path);
  }, [activeVersion?.id, projectMeta?.entry, projectFiles]);

  const selectedFileContent = useMemo(() => {
    if (!activeVersion) return "";
    const project = parseProject(activeVersion.code);
    return project.files[selectedFilePath] ?? getEntryCode(activeVersion.code);
  }, [activeVersion, selectedFilePath]);

  const totalLines = useMemo(
    () => projectFiles.reduce((n, f) => n + f.content.split("\n").length, 0),
    [projectFiles]
  );

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 25, 200)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 25, 50)), []);
  const handleResetZoom = useCallback(() => setZoom(100), []);

  const handleCopy = useCallback(async () => {
    if (!activeVersion) return;
    await navigator.clipboard.writeText(selectedFileContent || activeVersion.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeVersion, selectedFileContent]);

  const handleRefresh = useCallback(() => setIframeKey((k) => k + 1), []);

  const handleApplyEdit = useCallback(() => {
    if (!activeVersion || !onCodeEdit) return;
    const project = parseProject(activeVersion.code);
    const nextFiles = { ...project.files, [selectedFilePath]: editCode };
    const stored =
      Object.keys(nextFiles).length > 1
        ? serializeProject(nextFiles, project.entry)
        : editCode;
    if (stored !== activeVersion.code) {
      onCodeEdit(activeVersion.id, stored);
      setIframeKey((k) => k + 1);
    }
    setActiveTab("preview");
  }, [activeVersion, editCode, onCodeEdit, selectedFilePath]);

  // Keep edit buffer in sync with selected file
  useEffect(() => {
    if (!isEditing) setEditCode(selectedFileContent);
  }, [selectedFilePath, selectedFileContent, isEditing]);

  const emptyStream: StreamCodeState = streamCode ?? {
    code: "",
    isComplete: false,
    hasFence: false,
    lineCount: 0,
    charCount: 0,
  };

  // First generation: full build view
  if (versions.length === 0 && isGenerating) {
    return (
      <div className={cn("h-full", !fullscreen && "border-l border-border")}>
        <BuildView
          isGenerating
          streamText={streamText}
          streamCode={emptyStream}
          theme={currentTheme}
        />
      </div>
    );
  }

  if (versions.length === 0 && !isGenerating) {
    return (
      <div
        className={cn(
          "relative flex h-full flex-col items-center justify-center overflow-hidden bg-background",
          !fullscreen && "border-l border-border",
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(249,115,22,0.07),_transparent_60%)]" />
        <div className="relative z-10 px-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/35 bg-gradient-to-br from-orange-500/20 to-transparent shadow-[0_0_40px_-12px_rgba(249,115,22,0.45)]">
            <Layers className="h-7 w-7 text-orange-400" />
          </div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-400/80">
            Live canvas
          </p>
          <h3 className="mb-2 text-lg font-semibold tracking-tight text-foreground">
            Your UI appears here
          </h3>
          <p className="mx-auto max-w-[300px] text-sm leading-relaxed text-muted-foreground">
            Describe a product, landing page, or component in chat. Watch files stream in as the model builds — then iterate and ship.
          </p>
          <ol className="mx-auto mt-6 max-w-[280px] space-y-2.5 text-left text-xs text-muted-foreground">
            {[
              "Prompt or pick a launchpad template",
              "Watch the project build live",
              "Iterate · export · push to GitHub",
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-orange-500/25 bg-orange-500/10 text-[10px] font-bold text-orange-400">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col bg-background", fullscreen ? "h-screen" : "h-full border-l border-border")}>
      <div className={cn("flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 flex-wrap", fullscreen && "bg-background/90 backdrop-blur-sm")}>
        <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
          {([
            { key: "preview" as Tab, icon: Eye, label: "Preview" },
            {
              key: "code" as Tab,
              icon: Code2,
              label: activeVersion
                ? projectFiles.length > 1
                  ? `Code (${projectFiles.length} files)`
                  : `Code (${totalLines} lines)`
                : "Code",
            },
            { key: "edit" as Tab, icon: Pencil, label: "Edit" },
            { key: "audit" as Tab, icon: Gauge, label: "Audit" },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors",
                activeTab === key
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
          <div className="w-px h-4 bg-border/50 mx-0.5" />
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
              showTerminal
                ? "bg-emerald text-primary-foreground shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                : "text-muted-foreground hover:text-foreground hover:bg-background"
            )}
            title="Toggle Engine Terminal"
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            Terminal
          </button>

          <button
            onClick={() => userInfo?.plan === 'pro' ? setIsDevCenterOpen(!isDevCenterOpen) : onUpgrade?.()}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all relative",
              isDevCenterOpen
                ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.3)]"
                : "text-muted-foreground hover:text-foreground hover:bg-background"
            )}
            title="Developer Control Center"
          >
            <LayoutPanelLeft className="w-3.5 h-3.5" />
            Dev Center
            {userInfo?.plan !== 'pro' && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            )}
          </button>
        </div>

        {versions.length > 1 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <button
              onClick={() => onVersionChange(Math.max(0, activeVersionIndex - 1))}
              disabled={activeVersionIndex === 0}
              className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono tabular-nums">
              v{activeVersionIndex + 1}/{versions.length}
            </span>
            <button
              onClick={() => onVersionChange(Math.min(versions.length - 1, activeVersionIndex + 1))}
              disabled={activeVersionIndex === versions.length - 1}
              className="p-1 rounded hover:bg-accent disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-border/50 mx-1" />
            <button
              onClick={() => setIsCompareMode(!isCompareMode)}
              disabled={versions.length < 2}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                isCompareMode
                  ? "bg-amber-500/20 text-amber-500 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30"
              )}
              title="Compare with previous version"
            >
              <Split className="w-3 h-3" />
              UI Duel
            </button>
          </div>
        )}

        {activeTab === "preview" && (
          <>
            <div className="hidden items-center gap-0.5 rounded-lg border border-border/60 bg-muted/50 p-0.5 md:flex">
              {([
                { mode: "desktop" as DeviceMode, icon: Monitor },
                { mode: "tablet" as DeviceMode, icon: Tablet },
                { mode: "mobile" as DeviceMode, icon: Smartphone },
              ]).map(({ mode, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => setDeviceMode(mode)}
                  className={cn(
                    "rounded-md p-1.5 transition-all",
                    deviceMode === mode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={mode}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>

            <div className="hidden items-center gap-0.5 rounded-lg border border-border/60 bg-muted/50 px-1 py-0.5 md:flex">
              <button onClick={handleZoomOut} disabled={zoom <= 50} className="rounded p-1 transition-colors hover:bg-accent disabled:opacity-30">
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button onClick={handleResetZoom} className="min-w-12 rounded px-2 py-0.5 text-center font-mono text-xs tabular-nums transition-colors hover:bg-accent">
                {zoom}%
              </button>
              <button onClick={handleZoomIn} disabled={zoom >= 200} className="rounded p-1 transition-colors hover:bg-accent disabled:opacity-30">
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="relative" ref={themeDropdownRef}>
              <button
                onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Preview theme (light / dark canvas)"
              >
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-border shadow-inner"
                  style={{ background: currentTheme.bg }}
                />
                <span className="hidden max-w-[5.5rem] truncate sm:inline">{currentTheme.name}</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", themeDropdownOpen && "rotate-180")} />
              </button>
              {themeDropdownOpen && (
                <div className="absolute right-0 top-full z-20 mt-1.5 w-52 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-2xl">
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Preview canvas
                  </p>
                  {PREVIEW_THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onPreviewThemeChange(t.id);
                        setIframeKey((k) => k + 1);
                        setThemeDropdownOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors",
                        t.id === previewTheme
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-border shadow-sm"
                        style={{ background: t.bg }}
                      />
                      <span className="flex-1 font-medium">{t.name}</span>
                      {t.id === previewTheme && <Check className="h-3 w-3 text-emerald" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex items-center gap-1 ml-auto">
          {activeTab === "code" && (
            <button onClick={handleCopy} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Copy code">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
          {activeTab === "edit" && (
            <button onClick={handleApplyEdit} className="h-7 flex items-center gap-1.5 px-2.5 rounded-md bg-emerald text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
              <Check className="w-3.5 h-3.5" />
              Apply
            </button>
          )}
          {activeVersion && onShareLink && (
            <button
              onClick={onShareLink}
              className="h-7 flex items-center gap-1.5 px-2.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-xs font-medium"
              title="Copy shareable preview link"
            >
              {shareLinkCopied ? <Check className="w-3.5 h-3.5 text-emerald" /> : <Link2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{shareLinkCopied ? "Copied" : "Share"}</span>
            </button>
          )}
          {activeVersion && onPublish && (
            <button
              onClick={onPublish}
              disabled={publishBusy}
              className="h-7 flex items-center gap-1.5 px-2.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-xs font-medium disabled:opacity-50"
              title="Publish to community showcase"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{publishBusy ? "…" : "Publish"}</span>
            </button>
          )}
          {activeVersion && onDownloadHtml && (
            <button onClick={onDownloadHtml} className="hidden md:flex w-7 h-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Download HTML">
              <FileCode className="w-3.5 h-3.5" />
            </button>
          )}
          {activeVersion && onDownloadZip && (
            <button onClick={onDownloadZip} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Download ZIP">
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {activeVersion && onPushToGitHub && (
            <button
              onClick={onPushToGitHub}
              className="h-7 flex items-center gap-1.5 px-2.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-xs font-medium"
              title="One-click push to GitHub"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Push</span>
            </button>
          )}
          {activeVersion && onShareToCodeSandbox && (
            <button
              onClick={userInfo?.plan === "free" && userInfo?.connected ? onUpgrade : onShareToCodeSandbox}
              className="h-7 flex items-center gap-1.5 px-2.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-xs font-medium"
              title={userInfo?.plan === "free" && userInfo?.connected ? "Pro feature — click to upgrade" : "Open in CodeSandbox"}
            >
              <Box className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sandbox</span>
              {userInfo?.plan === "free" && userInfo?.connected && (
                <span className="text-[9px] bg-emerald/20 text-emerald px-1 rounded ml-0.5">PRO</span>
              )}
            </button>
          )}
          {activeVersion && onDeploy && (
            <button
              onClick={onDeploy}
              className="flex h-7 items-center gap-1.5 rounded-md bg-emerald px-2.5 text-xs font-bold text-zinc-950 transition-opacity hover:opacity-90"
              title="Ship: GitHub repo + Vercel import"
            >
              <Rocket className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ship</span>
            </button>
          )}
          <button onClick={handleRefresh} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="Refresh">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <div className="flex items-center gap-1 bg-accent/50 rounded-md px-1 py-0.5">
            <button onClick={handleZoomOut} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors" title="Zoom Out"><ZoomOut className="w-3 h-3" /></button>
            <button onClick={handleResetZoom} className="px-1.5 min-w-[32px] text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors text-center">{zoom}%</button>
            <button onClick={handleZoomIn} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors" title="Zoom In"><ZoomIn className="w-3 h-3" /></button>
          </div>
          <div className="w-px h-4 bg-border mx-1" />
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen (F)"}
            >
              {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

       {activeVersion && (
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                isGenerating
                  ? "animate-pulse bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                  : "bg-emerald shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              )}
            />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
              {isGenerating
                ? "Building"
                : activeVersionIndex === versions.length - 1
                  ? "Latest"
                  : "Earlier"}
            </span>
            <div className="mx-0.5 h-3 w-px shrink-0 bg-border" />
            <span className="max-w-48 truncate font-mono text-xs text-muted-foreground sm:max-w-60">
              {activeVersion.title}
            </span>
            <span className="hidden text-[10px] text-muted-foreground/60 sm:inline">
              {new Date(activeVersion.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {onRestoreVersion && activeVersionIndex < versions.length - 1 && (
            <button
              onClick={() => onRestoreVersion(activeVersionIndex)}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Restore
            </button>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-hidden relative">
        {activeTab === "preview" ? (
          <div className="h-full bg-zinc-900 flex items-start justify-center overflow-hidden relative">
            {/* Live build: first gen or iterate */}
            {isGenerating ? (
              <div className="absolute inset-0 z-20 bg-background">
                <BuildView
                  isGenerating
                  streamText={streamText}
                  streamCode={emptyStream}
                  theme={currentTheme}
                />
              </div>
            ) : null}
            {activeVersion ? (
                <div className="group/preview relative flex h-full min-h-0 w-full gap-4 transition-all duration-300">
                  <div
                    className={cn(
                      "relative min-h-0 min-w-0 flex-1 transition-all duration-500 ease-in-out",
                      isCompareMode ? "flex-[0.5]" : "flex-1"
                    )}
                  >
                    {isCompareMode && (
                      <div className="absolute -top-6 left-0 z-20 rounded border border-emerald/20 bg-emerald/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald">
                        Current (v{activeVersionIndex + 1})
                      </div>
                    )}
                      <iframe
                        key={`${activeVersion.id}-${iframeKey}-${previewTheme}-${mockProps}`}
                        srcDoc={wrapCodeForPreview(activeVersion.code, currentTheme, mockProps)}
                        className="h-full w-full rounded-xl border border-border shadow-2xl"
                        style={{
                          width: isCompareMode ? "100%" : DEVICE_WIDTHS[deviceMode],
                          maxWidth: "100%",
                          height: "100%",
                          minHeight: 480,
                          background: currentTheme.bg,
                        }}
                        sandbox="allow-scripts allow-same-origin"
                        title="Component Preview A"
                      />
                    </div>
  
                    {isCompareMode && versions[activeVersionIndex - 1] && (
                      <div className="relative min-h-0 min-w-0 flex-[0.5] transition-all duration-500 ease-in-out">
                        <div className="absolute -top-6 left-0 z-20 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-500">
                          Previous (v{activeVersionIndex})
                        </div>
                        <iframe
                          key={`${versions[activeVersionIndex - 1].id}-${iframeKey}-${previewTheme}-${mockProps}`}
                          srcDoc={wrapCodeForPreview(versions[activeVersionIndex - 1].code, currentTheme, mockProps)}

                        className="h-full w-full rounded-xl border border-border/50 opacity-80 shadow-2xl"
                        style={{ width: "100%", height: "100%", minHeight: 480, background: currentTheme.bg }}
                        sandbox="allow-scripts allow-same-origin"
                        title="Component Preview B"
                      />
                    </div>
                  )}

                  {!isCompareMode && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover/preview:opacity-100 transition-all duration-300 flex items-center gap-1 p-1 bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-2xl pointer-events-auto hover:scale-105 active:scale-100">
                      <button 
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? "Copied" : "Copy TSX"}
                      </button>
                      <div className="flex items-center gap-1.5 ml-auto border-l border-border pl-3">
                        <button
                          onClick={() => {
                            if (userInfo?.plan === 'pro') {
                              setIsDuelView(!isDuelView);
                            } else {
                              onUpgrade?.();
                            }
                          }}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all group relative",
                            isDuelView 
                              ? "bg-emerald/10 text-emerald border border-emerald/20" 
                              : "text-muted-foreground hover:bg-accent border border-transparent"
                          )}
                        >
                          <Columns className="w-3.5 h-3.5" />
                          {userInfo?.plan !== 'pro' && (
                            <span className="ml-1 px-1 py-0.5 rounded-[4px] bg-emerald text-[8px] font-bold text-emerald-foreground leading-none">PRO</span>
                          )}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-popover border border-border text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl font-mono uppercase tracking-tighter">
                            Compare Versions Side-by-Side
                          </div>
                        </button>
                      </div>
                      <div className="w-px h-4 bg-border mx-1" />
                      {onDownloadHtml && (
                        <button 
                          onClick={onDownloadHtml}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          HTML
                        </button>
                      )}
                      {onDownloadZip && (
                        <button 
                          onClick={onDownloadZip}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          ZIP
                        </button>
                      )}
                    </div>
                  )}
                </div>
            ) : null}
            
            {/* Visual Duel Overlay (PRO Feature) */}
            {isDuelView && nextVersionCode && (
              <div className="flex flex-col border-l border-border bg-black/40 backdrop-blur-3xl animate-in slide-in-from-right-full duration-500 overflow-hidden w-full lg:w-1/2">
                <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald font-mono">Comparing Generation</span>
                  </div>
                  <button onClick={() => setIsDuelView(false)} className="text-muted-foreground hover:text-foreground">
                    <Hash className="w-3 h-3 hover:rotate-90 transition-transform" />
                  </button>
                </div>
                <div className="flex-1 p-2 bg-[#080808]">
                  <div className="h-full rounded-xl border border-white/5 overflow-hidden shadow-2xl relative group bg-white/5">
                    <iframe
                      srcDoc={wrapCodeForPreview(nextVersionCode, currentTheme, mockProps)}
                      className="w-full h-full border-0 pointer-events-none"
                      title="Duel Preview"
                    />
                    <div className="absolute inset-0 bg-transparent" />
                    <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="px-1.5 py-0.5 rounded bg-black/80 text-[8px] font-mono border border-white/10 uppercase">v{activeVersionIndex > 0 ? activeVersionIndex : "P"} - 1</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Developer Control Center (PRO Feature) */}
            <AnimatePresence>
            {isDevCenterOpen && (
              <motion.div 
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="flex flex-col border-l border-border bg-[#0a0a0a] overflow-hidden w-full lg:w-1/3 z-30"
              >
                <div className="flex items-center justify-between px-4 py-3 bg-black border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Command className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold uppercase tracking-widest text-white">Dev Center</span>
                  </div>
                  <button onClick={() => setIsDevCenterOpen(false)} className="text-muted-foreground hover:text-foreground">
                    <Hash className="w-4 h-4 hover:rotate-90 transition-transform" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  {/* CLI Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">CLI Quick-Pull</h4>
                      <span className="text-[8px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">STABLE</span>
                    </div>
                    <div className="bg-black rounded-lg border border-white/5 p-3 relative group">
                      <code className="text-[10px] text-zinc-400 font-mono">
                        npx adgen pull {activeVersion?.id.slice(0, 8) || "latest"}
                      </code>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(`npx adgen pull ${activeVersion?.id.slice(0, 8) || "latest"}`);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-white/5 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <p className="text-[9px] text-zinc-500">Pull this component directly into your local Next.js project with styling preserved.</p>
                  </div>

                  {/* Prop Section */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Mock State (Live)</h4>
                    <div className="bg-black rounded-lg border border-emerald-500/10 overflow-hidden shadow-inner">
                       <textarea 
                          value={mockProps}
                          onChange={(e) => setMockProps(e.target.value)}
                          className="w-full h-40 bg-transparent p-3 text-[10px] font-mono text-emerald-500/80 outline-none resize-none selection:bg-emerald-500/20"
                       />
                    </div>
                    <p className="text-[9px] text-zinc-500 italic">Component will re-render in real-time with these props injected.</p>
                  </div>

                  {/* Context Section */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Environment Meta</h4>
                    <div className="grid grid-cols-2 gap-2">
                       <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                          <span className="block text-[8px] text-zinc-500 uppercase">Framework</span>
                          <span className="text-[10px] text-zinc-300">Next.js 15.0</span>
                       </div>
                       <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                          <span className="block text-[8px] text-zinc-500 uppercase">CSS Engine</span>
                          <span className="text-[10px] text-zinc-300">Tailwind 4.0</span>
                       </div>
                       <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                          <span className="block text-[8px] text-zinc-500 uppercase">Runtime</span>
                          <span className="text-[10px] text-zinc-300">Node v20</span>
                       </div>
                       <div className="p-2 rounded bg-zinc-900/50 border border-white/5">
                          <span className="block text-[8px] text-zinc-500 uppercase">IDX Sync</span>
                          <span className="text-[10px] text-emerald-500">Active</span>
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        ) : activeTab === "audit" ? (
          <PerformanceAudit 
            code={activeVersion?.code} 
            sessionId={activeVersion?.id} 
          />
        ) : activeTab === "code" || activeTab === "edit" ? (
          <div className="flex h-full flex-col overflow-hidden bg-[#1e1e1e]">
            {/* Breadcrumb + file tabs (workbench-style) */}
            <div className="flex shrink-0 flex-col border-b border-white/10 bg-[#181818]">
              <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-1 font-mono text-[10px] text-white/45">
                <span className="text-white/30">project</span>
                {selectedFilePath.split("/").map((seg, i, arr) => (
                  <span key={`${seg}-${i}`} className="flex items-center gap-1.5">
                    <span className="text-white/25">/</span>
                    <span className={i === arr.length - 1 ? "text-orange-300/90" : ""}>
                      {seg}
                    </span>
                  </span>
                ))}
                {projectFiles.length > 1 && (
                  <span className="ml-auto text-white/30">
                    {projectFiles.length} files · {totalLines} lines
                  </span>
                )}
              </div>
              {projectFiles.length > 1 && (
                <div className="flex items-stretch gap-0 overflow-x-auto">
                  {projectFiles.map((f) => {
                    const active = selectedFilePath === f.path;
                    const short = f.path.replace(/^src\//, "");
                    return (
                      <button
                        key={f.path}
                        type="button"
                        onClick={() => {
                          setSelectedFilePath(f.path);
                          setIsEditing(false);
                        }}
                        className={cn(
                          "flex shrink-0 items-center gap-1.5 border-r border-white/5 px-3 py-1.5 font-mono text-[11px] transition-colors",
                          active
                            ? "bg-[#1e1e1e] text-orange-300"
                            : "bg-transparent text-white/45 hover:bg-white/5 hover:text-white/80"
                        )}
                      >
                        <FileCode className="h-3 w-3 shrink-0 opacity-70" />
                        {short}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {projectFiles.length > 1 && (
                <aside className="hidden w-40 shrink-0 flex-col border-r border-white/10 bg-[#141414] lg:flex">
                  <div className="border-b border-white/10 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Explorer
                  </div>
                  <div className="flex-1 overflow-y-auto p-1">
                    {projectFiles.map((f) => (
                      <button
                        key={f.path}
                        type="button"
                        onClick={() => {
                          setSelectedFilePath(f.path);
                          setIsEditing(false);
                        }}
                        className={cn(
                          "mb-0.5 flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left font-mono text-[11px] transition-colors",
                          selectedFilePath === f.path
                            ? "bg-white/10 text-orange-300"
                            : "text-white/50 hover:bg-white/5 hover:text-white/80"
                        )}
                      >
                        <FileCode className="h-3 w-3 shrink-0 opacity-70" />
                        <span className="truncate">{f.path.replace(/^src\//, "")}</span>
                      </button>
                    ))}
                  </div>
                </aside>
              )}
              <div className="min-w-0 flex-1">
                {activeVersion && (
                  <Editor
                    height="100%"
                    path={selectedFilePath}
                    defaultLanguage="typescript"
                    theme="vs-dark"
                    value={activeTab === "edit" ? editCode : selectedFileContent}
                    onChange={
                      activeTab === "edit"
                        ? (value) => {
                            setEditCode(value || "");
                            setIsEditing(true);
                          }
                        : undefined
                    }
                    options={{
                      readOnly: activeTab === "code",
                      minimap: { enabled: false },
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                      scrollBeyondLastLine: false,
                      lineNumbers: "on",
                      roundedSelection: false,
                      padding: { top: 16 },
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Floating Version Timeline */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none group/timeline">
          <div className="pointer-events-auto opacity-0 group-hover/timeline:opacity-100 lg:opacity-100 transition-opacity">
            <VersionTimeline 
              versions={versions}
              activeVersionIndex={activeVersionIndex}
              onVersionChange={onVersionChange}
            />
          </div>
        </div>
      </div>
    </div>

    {/* Terminal Overlay (Bottom) */}
    {showTerminal && (
      <div className="h-[200px] border-t border-border shrink-0 animate-in slide-in-from-bottom duration-300">
        <TerminalLogs isGenerating={isGenerating} />
      </div>
    )}
  </div>
);
}
