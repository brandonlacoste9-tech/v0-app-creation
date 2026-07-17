"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import type { GitHubStatus, GitHubRepo } from "@/lib/types";
import {
  fetchGitHubRepos,
  createRepoAndPush,
  pushToExistingRepo,
  disconnectGitHub,
  connectGitHubWithPat,
  startGitHubAuth,
} from "@/lib/api-client";
import {
  Plus,
  FolderGit2,
  Lock,
  Globe,
  ExternalLink,
  Loader2,
  Check,
  AlertCircle,
  LogOut,
  Search,
  KeyRound,
  Package,
  ChevronDown,
  ChevronUp,
  Rocket,
} from "lucide-react";
import { GithubIcon } from "@/components/icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Mode = "new" | "existing";
type PushState = "idle" | "pushing" | "success" | "error";

interface GitHubPushDialogProps {
  open: boolean;
  onClose: () => void;
  code: string;
  title: string;
  githubStatus: GitHubStatus | undefined;
  onConnectGitHub: () => void;
  onDisconnect: () => void;
  onConnected?: () => void;
  /** When true and already connected, start create+push immediately */
  autoPush?: boolean;
  /** BYOB schema → Drizzle layer on ship */
  byobSchema?: import("@/lib/byob/types").DatabaseSchemaMap | null;
  /** Phase C custom agent tools */
  customTools?: import("@/lib/byob/agent-types").CustomAgentTool[] | null;
}

function slugFromTitle(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 40) || "Shipboard-project"
  );
}

export function GitHubPushDialog({
  open,
  onClose,
  code,
  title,
  githubStatus,
  onConnectGitHub,
  onDisconnect,
  onConnected,
  autoPush = false,
  byobSchema = null,
  customTools = null,
}: GitHubPushDialogProps) {
  const [mode, setMode] = useState<Mode>("new");
  const [repoName, setRepoName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [branch, setBranch] = useState("main");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [repoSearch, setRepoSearch] = useState("");
  const [pushState, setPushState] = useState<PushState>("idle");
  const [resultUrl, setResultUrl] = useState("");
  const [filesWritten, setFilesWritten] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [pat, setPat] = useState("");
  const [patConnecting, setPatConnecting] = useState(false);
  const [oauthAvailable, setOauthAvailable] = useState<boolean | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPatFallback, setShowPatFallback] = useState(false);
  const autoPushDone = useRef(false);

  useEffect(() => {
    if (open) {
      const slug = slugFromTitle(title);
      setRepoName(slug);
      setDescription(`Generated with Shipboard: ${title}`);
      setCommitMessage(`feat: add ${title} via Shipboard`);
      setBranch("main");
      setPushState("idle");
      setResultUrl("");
      setErrorMessage("");
      setFilesWritten(0);
      setPat("");
      setShowAdvanced(false);
      setMode("new");
      autoPushDone.current = false;
      setOauthAvailable(githubStatus?.oauthConfigured ?? null);
      // Only show PAT by default when OAuth isn't set up (founder/dev)
      setShowPatFallback(githubStatus?.oauthConfigured === false);
    }
  }, [open, title, githubStatus?.oauthConfigured]);

  useEffect(() => {
    if (open && githubStatus?.connected && mode === "existing") {
      setReposLoading(true);
      fetchGitHubRepos()
        .then(setRepos)
        .catch(() => setRepos([]))
        .finally(() => setReposLoading(false));
    }
  }, [open, githubStatus?.connected, mode]);

  useEffect(() => {
    if (!open || githubStatus?.connected) return;
    if (githubStatus?.oauthConfigured !== undefined) {
      setOauthAvailable(githubStatus.oauthConfigured);
      return;
    }
    startGitHubAuth()
      .then(() => setOauthAvailable(true))
      .catch(() => setOauthAvailable(false));
  }, [open, githubStatus?.connected, githubStatus?.oauthConfigured]);

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      (r.description || "").toLowerCase().includes(repoSearch.toLowerCase())
  );

  const handlePush = useCallback(async () => {
    if (!code?.trim()) {
      setPushState("error");
      setErrorMessage("No code to push. Generate a component first.");
      return;
    }
    setPushState("pushing");
    setErrorMessage("");
    try {
      if (mode === "new") {
        const result = await createRepoAndPush({
          repoName: repoName || slugFromTitle(title),
          description: description || `Generated with Shipboard: ${title}`,
          isPrivate,
          code,
          commitMessage: commitMessage || `feat: add ${title} via Shipboard`,
          title,
          stack: "next",
          byobSchema: byobSchema || null,
          customTools: customTools || null,
        });
        setResultUrl(result.url);
        setFilesWritten(result.filesWritten ?? 0);
      } else {
        if (!selectedRepo) {
          setPushState("error");
          setErrorMessage("Select a repository");
          return;
        }
        const result = await pushToExistingRepo({
          repoFullName: selectedRepo,
          code,
          commitMessage: commitMessage || `feat: update ${title} via Shipboard`,
          branch,
          fullProject: true,
          title,
          stack: "next",
          byobSchema: byobSchema || null,
          customTools: customTools || null,
        });
        setResultUrl(result.url);
        setFilesWritten(result.filesWritten ?? 0);
      }
      setPushState("success");
    } catch (err: unknown) {
      setPushState("error");
      setErrorMessage(err instanceof Error ? err.message : "Push failed");
    }
  }, [
    mode,
    repoName,
    description,
    isPrivate,
    code,
    byobSchema,
    customTools,
    selectedRepo,
    commitMessage,
    branch,
    title,
  ]);

  // One-click: already connected + autoPush → push immediately
  useEffect(() => {
    if (!open || !autoPush || !githubStatus?.connected) return;
    if (autoPushDone.current) return;
    if (!code?.trim()) return;
    autoPushDone.current = true;
    void handlePush();
  }, [open, autoPush, githubStatus?.connected, code, handlePush]);

  const handlePatConnect = useCallback(async () => {
    if (!pat.trim()) return;
    setPatConnecting(true);
    setErrorMessage("");
    try {
      await connectGitHubWithPat(pat.trim());
      setPat("");
      onConnected?.();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Invalid token");
    } finally {
      setPatConnecting(false);
    }
  }, [pat, onConnected]);

  const handleDisconnect = useCallback(async () => {
    await disconnectGitHub();
    onDisconnect();
  }, [onDisconnect]);

  const isConnected = githubStatus?.connected;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && pushState !== "pushing") onClose();
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <GithubIcon className="h-4 w-4 text-muted-foreground" />
            Push to GitHub
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* ── Not connected: one big GitHub button ── */}
          {!isConnected && pushState === "idle" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted/50">
                <GithubIcon className="h-7 w-7 text-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">One click to ship</h3>
                <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
                  Connect GitHub, then we create a full Next.js App Router repo for you. No tokens to
                  copy.
                </p>
              </div>

              {oauthAvailable !== false ? (
                <Button type="button" className="w-full" size="lg" onClick={onConnectGitHub}>
                  <GithubIcon className="h-4 w-4" />
                  Continue with GitHub
                </Button>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-left text-xs text-amber-100/90">
                  <p className="font-medium text-amber-50">OAuth not configured yet</p>
                  <p className="mt-1">
                    Add <code className="font-mono">GITHUB_CLIENT_ID</code> and{" "}
                    <code className="font-mono">GITHUB_CLIENT_SECRET</code> so users only click
                    once. Until then, use a personal token below (dev only).
                  </p>
                </div>
              )}

              {(showPatFallback || oauthAvailable === false) && (
                <div className="border-t border-border pt-4 text-left">
                  <button
                    type="button"
                    onClick={() => setShowPatFallback((v) => !v)}
                    className="mb-2 flex w-full items-center justify-between text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="h-3 w-3" />
                      Advanced: personal access token
                    </span>
                    {showPatFallback ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                  {showPatFallback && (
                    <div className="space-y-2">
                      <input
                        type="password"
                        value={pat}
                        onChange={(e) => setPat(e.target.value)}
                        placeholder="ghp_… (repo scope)"
                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-ring"
                        autoComplete="off"
                      />
                      {errorMessage && (
                        <p className="text-xs text-destructive">{errorMessage}</p>
                      )}
                      <button
                        type="button"
                        onClick={handlePatConnect}
                        disabled={!pat.trim() || patConnecting}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-40"
                      >
                        {patConnecting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <KeyRound className="h-3.5 w-3.5" />
                        )}
                        Connect with token
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Pushing ── */}
          {isConnected && pushState === "pushing" && (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto mb-3 h-9 w-9 animate-spin text-orange-400" />
              <p className="text-sm font-semibold text-foreground">Pushing your project…</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Creating repo and writing Next.js + React + Tailwind files
              </p>
            </div>
          )}

          {/* ── Success ── */}
          {pushState === "success" && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald/10">
                <Check className="h-6 w-6 text-emerald" />
              </div>
              <h3 className="mb-1 font-semibold text-foreground">Live on GitHub</h3>
              <p className="mb-1 text-sm text-muted-foreground">
                Next.js project pushed
                {filesWritten > 0 ? ` · ${filesWritten} files` : ""}.
              </p>
              <p className="mb-4 font-mono text-[11px] text-muted-foreground">
                git clone · npm i · npm run dev
              </p>
              <div className="space-y-2">
                <a
                  href={resultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background hover:opacity-90"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open repository
                </a>
                <a
                  href={`https://vercel.com/new/clone?repository-url=${encodeURIComponent(resultUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald px-4 py-3 text-sm font-bold text-primary-foreground hover:opacity-95"
                >
                  <Rocket className="h-4 w-4" />
                  Deploy to Vercel
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `git clone ${resultUrl}.git\ncd ${resultUrl.split("/").pop()}\nnpm install\nnpm run dev`
                      );
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Copy clone commands
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Done
              </button>
            </div>
          )}

          {/* ── Error ── */}
          {pushState === "error" && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="mb-2 font-semibold text-foreground">Push failed</h3>
              <p className="mb-4 text-sm text-destructive">{errorMessage}</p>
              <button
                type="button"
                onClick={() => setPushState("idle")}
                className="rounded-lg bg-accent px-4 py-2 text-sm text-foreground hover:opacity-90"
              >
                Try again
              </button>
            </div>
          )}

          {/* ── Connected: one-click primary ── */}
          {isConnected && pushState === "idle" && (
            <>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  {githubStatus?.avatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={githubStatus.avatarUrl}
                      alt=""
                      className="h-7 w-7 rounded-full"
                    />
                  )}
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">
                      {githubStatus?.username}
                    </p>
                    <p className="text-[10px] text-emerald">Connected</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="h-3 w-3" />
                  Switch
                </button>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2.5 text-xs text-muted-foreground">
                <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" />
                <span>
                  Creates a new public repo{" "}
                  <span className="font-mono text-foreground">
                    {repoName || slugFromTitle(title)}
                  </span>{" "}
                  with a full Next.js App Router + TypeScript + Tailwind project.
                </span>
              </div>

              <button
                type="button"
                onClick={handlePush}
                disabled={!code?.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-40"
              >
                <Rocket className="h-4 w-4" />
                Push project to GitHub
              </button>

              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {showAdvanced ? "Hide options" : "More options"}
                {showAdvanced ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>

              {showAdvanced && (
                <div className="space-y-4 border-t border-border pt-4">
                  <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
                    {(
                      [
                        { key: "new" as Mode, icon: Plus, label: "New repo" },
                        { key: "existing" as Mode, icon: FolderGit2, label: "Existing" },
                      ] as const
                    ).map(({ key, icon: Icon, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setMode(key)}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium",
                          mode === key
                            ? "bg-background text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>

                  {mode === "new" ? (
                    <div className="space-y-3">
                      <Field label="Repository name">
                        <input
                          value={repoName}
                          onChange={(e) =>
                            setRepoName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, "-"))
                          }
                          className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-ring"
                        />
                      </Field>
                      <Field label="Visibility">
                        <div className="flex gap-2">
                          {(
                            [
                              { priv: false, icon: Globe, label: "Public" },
                              { priv: true, icon: Lock, label: "Private" },
                            ] as const
                          ).map(({ priv, icon: Icon, label }) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setIsPrivate(priv)}
                              className={cn(
                                "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium",
                                isPrivate === priv
                                  ? "border-foreground bg-accent text-foreground"
                                  : "border-border text-muted-foreground"
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {label}
                            </button>
                          ))}
                        </div>
                      </Field>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Field label="Repository">
                        <div className="relative mb-2">
                          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={repoSearch}
                            onChange={(e) => setRepoSearch(e.target.value)}
                            placeholder="Search…"
                            className="w-full rounded-lg border border-border bg-muted py-2 pl-9 pr-3 text-sm outline-none focus:border-ring"
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                          {reposLoading ? (
                            <div className="flex justify-center py-6">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : filteredRepos.length === 0 ? (
                            <p className="py-4 text-center text-xs text-muted-foreground">
                              No repos
                            </p>
                          ) : (
                            filteredRepos.map((repo) => (
                              <button
                                key={repo.fullName}
                                type="button"
                                onClick={() => setSelectedRepo(repo.fullName)}
                                className={cn(
                                  "flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-0",
                                  selectedRepo === repo.fullName
                                    ? "bg-accent text-foreground"
                                    : "text-muted-foreground hover:bg-accent/50"
                                )}
                              >
                                {repo.private ? (
                                  <Lock className="h-3 w-3" />
                                ) : (
                                  <Globe className="h-3 w-3" />
                                )}
                                <span className="truncate font-medium">{repo.name}</span>
                                {selectedRepo === repo.fullName && (
                                  <Check className="ml-auto h-3.5 w-3.5 text-emerald" />
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </Field>
                      <Field label="Branch">
                        <input
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          className="w-full rounded-lg border border-border bg-muted px-3 py-2 font-mono text-sm outline-none focus:border-ring"
                        />
                      </Field>
                    </div>
                  )}

                  <Button
                    type="button"
                    className="w-full"
                    onClick={handlePush}
                    disabled={
                      !code?.trim() ||
                      (mode === "existing" && !selectedRepo) ||
                      (mode === "new" && !repoName.trim())
                    }
                  >
                    {mode === "new" ? "Create & push" : "Push to selected repo"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 text-left">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
