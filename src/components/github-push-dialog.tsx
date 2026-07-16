"use client";

import { useState, useEffect, useCallback } from "react";
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
  X,
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
  FileCode,
  KeyRound,
  Package,
} from "lucide-react";
import { GithubIcon } from "@/components/icons";

type Mode = "new" | "existing";
type PushState = "idle" | "pushing" | "success" | "error";
type ConnectTab = "oauth" | "pat";

interface GitHubPushDialogProps {
  open: boolean;
  onClose: () => void;
  code: string;
  title: string;
  githubStatus: GitHubStatus | undefined;
  onConnectGitHub: () => void;
  onDisconnect: () => void;
  /** Called after successful PAT connect so parent can refresh status */
  onConnected?: () => void;
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
}: GitHubPushDialogProps) {
  const [mode, setMode] = useState<Mode>("new");
  const [connectTab, setConnectTab] = useState<ConnectTab>("pat");
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

  useEffect(() => {
    if (open) {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 40);
      setRepoName(slug || "adgenai-project");
      setDescription(`Generated with AdGenAI: ${title}`);
      setCommitMessage(`feat: add ${title} via AdGenAI`);
      setBranch("main");
      setPushState("idle");
      setResultUrl("");
      setErrorMessage("");
      setFilesWritten(0);
      setPat("");
      // Prefer PAT tab when OAuth is not configured
      if (githubStatus && githubStatus.oauthConfigured === false) {
        setConnectTab("pat");
      }
      setOauthAvailable(githubStatus?.oauthConfigured ?? null);
    }
  }, [open, title, githubStatus]);

  useEffect(() => {
    if (open && githubStatus?.connected && mode === "existing") {
      setReposLoading(true);
      fetchGitHubRepos()
        .then(setRepos)
        .catch(() => setRepos([]))
        .finally(() => setReposLoading(false));
    }
  }, [open, githubStatus?.connected, mode]);

  // Probe OAuth availability when dialog opens disconnected
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
          repoName,
          description,
          isPrivate,
          code,
          commitMessage,
          title,
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
          commitMessage,
          branch,
          fullProject: true,
          title,
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
    selectedRepo,
    commitMessage,
    branch,
    title,
  ]);

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

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  const isConnected = githubStatus?.connected;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-full max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col animate-fadeIn rounded-xl border border-border bg-card shadow-2xl md:max-w-lg">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <GithubIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Push to GitHub</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {!isConnected ? (
            <div className="space-y-4">
              <div className="text-center">
                <GithubIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <h3 className="mb-1 font-medium text-foreground">Connect to GitHub</h3>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                  Push a full Vite + React + Tailwind project so you can clone, run, and ship.
                </p>
              </div>

              <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
                <button
                  type="button"
                  onClick={() => setConnectTab("pat")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                    connectTab === "pat"
                      ? "bg-background text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Access token
                </button>
                <button
                  type="button"
                  onClick={() => setConnectTab("oauth")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                    connectTab === "oauth"
                      ? "bg-background text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <GithubIcon className="h-3.5 w-3.5" />
                  OAuth
                </button>
              </div>

              {connectTab === "pat" ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Create a{" "}
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo&description=AdGenAI"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 underline-offset-2 hover:underline"
                    >
                      classic PAT with <code className="font-mono">repo</code> scope
                    </a>
                    , paste it below. Token is stored in an encrypted httpOnly cookie.
                  </p>
                  <input
                    type="password"
                    value={pat}
                    onChange={(e) => setPat(e.target.value)}
                    placeholder="ghp_… or github_pat_…"
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors focus:border-ring"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {errorMessage && (
                    <p className="text-xs text-destructive">{errorMessage}</p>
                  )}
                  <button
                    type="button"
                    onClick={handlePatConnect}
                    disabled={!pat.trim() || patConnecting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {patConnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    {patConnecting ? "Connecting…" : "Connect with token"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  {oauthAvailable === false ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-left text-xs text-amber-100/90">
                      <p className="font-medium text-amber-50">OAuth app not configured</p>
                      <p className="mt-1">
                        Add <code className="font-mono">GITHUB_CLIENT_ID</code> and{" "}
                        <code className="font-mono">GITHUB_CLIENT_SECRET</code> to{" "}
                        <code className="font-mono">.env.local</code>, with callback{" "}
                        <code className="font-mono">/api/github/callback</code>. Or use an
                        access token instead.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Opens GitHub to authorize AdGenAI (repo + profile read).
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={onConnectGitHub}
                    disabled={oauthAvailable === false}
                    className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <GithubIcon className="h-4 w-4" />
                    Connect with GitHub
                  </button>
                </div>
              )}
            </div>
          ) : pushState === "success" ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald/10">
                <Check className="h-6 w-6 text-emerald" />
              </div>
              <h3 className="mb-2 font-medium text-foreground">Pushed successfully</h3>
              <p className="mb-1 text-sm text-muted-foreground">
                Full Vite project is on GitHub
                {filesWritten > 0 ? ` (${filesWritten} files)` : ""}.
              </p>
              <p className="mb-4 font-mono text-[11px] text-muted-foreground">
                npm install && npm run dev
              </p>
              <a
                href={resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in GitHub
              </a>
            </div>
          ) : pushState === "error" ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="mb-2 font-medium text-foreground">Push failed</h3>
              <p className="mb-4 text-sm text-destructive">{errorMessage}</p>
              {resultUrl && (
                <a
                  href={resultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                  Repo may still exist on GitHub
                </a>
              )}
              <button
                onClick={() => setPushState("idle")}
                className="rounded-lg bg-accent px-4 py-2 text-sm text-foreground transition-opacity hover:opacity-90"
              >
                Try again
              </button>
            </div>
          ) : pushState === "pushing" ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-orange-400" />
              <p className="text-sm font-medium text-foreground">
                {mode === "new" ? "Creating repo & pushing files…" : "Pushing project files…"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Writing package.json, Component.tsx, Vite config…
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {githubStatus?.avatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={githubStatus.avatarUrl}
                      alt=""
                      className="h-6 w-6 rounded-full"
                    />
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {githubStatus?.username}
                  </span>
                  <span className="rounded bg-emerald/10 px-1.5 py-0.5 text-xs text-emerald">
                    Connected
                  </span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                >
                  <LogOut className="h-3 w-3" />
                  Disconnect
                </button>
              </div>

              <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
                {(
                  [
                    { key: "new" as Mode, icon: Plus, label: "New Repository" },
                    { key: "existing" as Mode, icon: FolderGit2, label: "Existing Repository" },
                  ] as const
                ).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
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

              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-400" />
                <span>
                  Pushes a <span className="font-medium text-foreground">full Vite project</span>
                  :{" "}
                  <span className="font-mono text-foreground">src/Component.tsx</span>,{" "}
                  <span className="font-mono text-foreground">package.json</span>, Tailwind,
                  README — ready for <span className="font-mono">npm run dev</span>.
                </span>
              </div>

              {mode === "new" ? (
                <div className="space-y-4">
                  <Field label="Repository Name">
                    <input
                      value={repoName}
                      onChange={(e) =>
                        setRepoName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, "-"))
                      }
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
                    />
                  </Field>
                  <Field label="Description">
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
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
                          onClick={() => setIsPrivate(priv)}
                          className={cn(
                            "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors",
                            isPrivate === priv
                              ? "border-foreground bg-accent text-foreground"
                              : "border-border text-muted-foreground hover:bg-accent"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Commit Message">
                    <input
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
                    />
                  </Field>
                </div>
              ) : (
                <div className="space-y-4">
                  <Field label="Select Repository">
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={repoSearch}
                        onChange={(e) => setRepoSearch(e.target.value)}
                        placeholder="Search repos..."
                        className="w-full rounded-lg border border-border bg-muted py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors focus:border-ring"
                      />
                    </div>
                    <div className="max-h-44 overflow-y-auto overflow-hidden rounded-lg border border-border">
                      {reposLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : filteredRepos.length === 0 ? (
                        <div className="py-6 text-center text-xs text-muted-foreground">
                          No repos found
                        </div>
                      ) : (
                        filteredRepos.map((repo) => (
                          <button
                            key={repo.fullName}
                            onClick={() => setSelectedRepo(repo.fullName)}
                            className={cn(
                              "flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-b-0",
                              selectedRepo === repo.fullName
                                ? "bg-accent text-foreground"
                                : "text-muted-foreground hover:bg-accent/50"
                            )}
                          >
                            {repo.private ? (
                              <Lock className="h-3 w-3 shrink-0" />
                            ) : (
                              <Globe className="h-3 w-3 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium text-foreground">
                                {repo.name}
                              </div>
                              {repo.description && (
                                <div className="truncate text-xs text-muted-foreground">
                                  {repo.description}
                                </div>
                              )}
                            </div>
                            {selectedRepo === repo.fullName && (
                              <Check className="h-3.5 w-3.5 shrink-0 text-emerald" />
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
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors focus:border-ring"
                      placeholder="main"
                    />
                  </Field>
                  <Field label="Commit Message">
                    <input
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
                    />
                  </Field>
                </div>
              )}
            </>
          )}
        </div>

        {isConnected && pushState === "idle" && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-4">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handlePush}
              disabled={
                !code?.trim() ||
                (mode === "new" && !repoName.trim()) ||
                (mode === "existing" && !selectedRepo)
              }
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <FileCode className="h-3.5 w-3.5" />
              {mode === "new" ? "Create & Push Project" : "Push Project"}
            </button>
          </div>
        )}

        {isConnected && (pushState === "success" || pushState === "error") && (
          <div className="flex shrink-0 items-center justify-end border-t border-border px-5 py-4">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
