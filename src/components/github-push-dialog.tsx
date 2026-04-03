"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { GitHubStatus, GitHubRepo } from "@/lib/types";
import { fetchGitHubRepos, createRepoAndPush, pushToExistingRepo, disconnectGitHub } from "@/lib/api-client";
import {
  X, Plus, FolderGit2, Lock, Globe, ExternalLink,
  Loader2, Check, AlertCircle, LogOut, Search, FileCode,
} from "lucide-react";
import { GithubIcon } from "@/components/icons";

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
}

export function GitHubPushDialog({
  open, onClose, code, title, githubStatus, onConnectGitHub, onDisconnect,
}: GitHubPushDialogProps) {
  const [mode, setMode] = useState<Mode>("new");
  const [repoName, setRepoName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [fileName, setFileName] = useState("src/Component.tsx");
  const [commitMessage, setCommitMessage] = useState("");
  const [branch, setBranch] = useState("main");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [repoSearch, setRepoSearch] = useState("");
  const [pushState, setPushState] = useState<PushState>("idle");
  const [resultUrl, setResultUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 40);
      setRepoName(slug || "adgenai-project");
      setDescription(`Generated with AdGenAI: ${title}`);
      setCommitMessage(`feat: add ${title} component via AdGenAI`);
      setBranch("main");
      setPushState("idle");
      setResultUrl("");
      setErrorMessage("");
    }
  }, [open, title]);

  useEffect(() => {
    if (open && githubStatus?.connected && mode === "existing") {
      setReposLoading(true);
      fetchGitHubRepos().then(setRepos).catch(() => setRepos([])).finally(() => setReposLoading(false));
    }
  }, [open, githubStatus?.connected, mode]);

  const filteredRepos = repos.filter(
    (r) => r.name.toLowerCase().includes(repoSearch.toLowerCase()) || (r.description || "").toLowerCase().includes(repoSearch.toLowerCase())
  );

  const handlePush = useCallback(async () => {
    setPushState("pushing");
    try {
      if (mode === "new") {
        const result = await createRepoAndPush({ repoName, description, isPrivate, code, fileName });
        setResultUrl(result.url);
      } else {
        if (!selectedRepo) return;
        const result = await pushToExistingRepo({ repoFullName: selectedRepo, code, fileName, commitMessage, branch });
        setResultUrl(result.url);
      }
      setPushState("success");
    } catch (err: unknown) {
      setPushState("error");
      setErrorMessage(err instanceof Error ? err.message : "Push failed");
    }
  }, [mode, repoName, description, isPrivate, code, fileName, selectedRepo, commitMessage, branch]);

  const handleDisconnect = useCallback(async () => {
    await disconnectGitHub();
    onDisconnect();
  }, [onDisconnect]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  const isConnected = githubStatus?.connected;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[calc(100vw-2rem)] md:max-w-lg bg-card border border-border rounded-xl shadow-2xl max-h-[85vh] flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <GithubIcon className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Push to GitHub</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!isConnected ? (
            <div className="text-center py-8">
              <GithubIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-foreground font-medium mb-2">Connect to GitHub</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">Sign in with GitHub to push your generated code directly to a repository.</p>
              <button onClick={onConnectGitHub} className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-lg font-medium text-sm hover:opacity-90 transition-opacity">
                <GithubIcon className="w-4 h-4" />Connect GitHub
              </button>
            </div>
          ) : pushState === "success" ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-emerald/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-6 h-6 text-emerald" />
              </div>
              <h3 className="text-foreground font-medium mb-2">Pushed successfully</h3>
              <p className="text-muted-foreground text-sm mb-4">Your code has been pushed to GitHub.</p>
              <a href={resultUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg font-medium text-sm hover:opacity-90 transition-opacity">
                <ExternalLink className="w-3.5 h-3.5" />Open in GitHub
              </a>
            </div>
          ) : pushState === "error" ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-foreground font-medium mb-2">Push failed</h3>
              <p className="text-destructive text-sm mb-4">{errorMessage}</p>
              <button onClick={() => setPushState("idle")} className="px-4 py-2 text-sm rounded-lg bg-accent text-foreground hover:opacity-90 transition-opacity">Try again</button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {githubStatus?.avatarUrl && <img src={githubStatus.avatarUrl} alt="" className="w-6 h-6 rounded-full" />}
                  <span className="text-sm text-foreground font-medium">{githubStatus?.username}</span>
                  <span className="text-xs text-emerald bg-emerald/10 px-1.5 py-0.5 rounded">Connected</span>
                </div>
                <button onClick={handleDisconnect} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                  <LogOut className="w-3 h-3" />Disconnect
                </button>
              </div>

              <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                {([{ key: "new" as Mode, icon: Plus, label: "New Repository" }, { key: "existing" as Mode, icon: FolderGit2, label: "Existing Repository" }]).map(({ key, icon: Icon, label }) => (
                  <button key={key} onClick={() => setMode(key)} className={cn("flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors", mode === key ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground")}>
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </div>

              {/* File summary */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
                <FileCode className="w-3.5 h-3.5 shrink-0" />
                <span>2 files will be pushed: <span className="text-foreground font-mono">{fileName}</span>, <span className="text-foreground font-mono">index.html</span></span>
              </div>

              {mode === "new" ? (
                <div className="space-y-4">
                  <Field label="Repository Name">
                    <input value={repoName} onChange={(e) => setRepoName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, "-"))} className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors" />
                  </Field>
                  <Field label="Description">
                    <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors" />
                  </Field>
                  <Field label="Visibility">
                    <div className="flex gap-2">
                      {([{ priv: false, icon: Globe, label: "Public" }, { priv: true, icon: Lock, label: "Private" }] as const).map(({ priv, icon: Icon, label }) => (
                        <button key={label} onClick={() => setIsPrivate(priv)} className={cn("flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors", isPrivate === priv ? "border-foreground bg-accent text-foreground" : "border-border text-muted-foreground hover:bg-accent")}>
                          <Icon className="w-3.5 h-3.5" />{label}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="File Path">
                    <input value={fileName} onChange={(e) => setFileName(e.target.value)} className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono outline-none focus:border-ring transition-colors" />
                  </Field>
                  <Field label="Commit Message">
                    <input value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors" />
                  </Field>
                </div>
              ) : (
                <div className="space-y-4">
                  <Field label="Select Repository">
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input value={repoSearch} onChange={(e) => setRepoSearch(e.target.value)} placeholder="Search repos..." className="w-full bg-muted border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors" />
                    </div>
                    <div className="border border-border rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                      {reposLoading ? (
                        <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                      ) : filteredRepos.length === 0 ? (
                        <div className="text-center py-6 text-xs text-muted-foreground">No repos found</div>
                      ) : filteredRepos.map((repo) => (
                        <button key={repo.fullName} onClick={() => setSelectedRepo(repo.fullName)} className={cn("w-full flex items-center gap-2 px-3 py-2 text-left border-b border-border last:border-b-0 transition-colors text-sm", selectedRepo === repo.fullName ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50")}>
                          {repo.private ? <Lock className="w-3 h-3 shrink-0" /> : <Globe className="w-3 h-3 shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-foreground truncate">{repo.name}</div>
                            {repo.description && <div className="text-xs text-muted-foreground truncate">{repo.description}</div>}
                          </div>
                          {selectedRepo === repo.fullName && <Check className="w-3.5 h-3.5 text-emerald shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Branch">
                    <input value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono outline-none focus:border-ring transition-colors" placeholder="main" />
                  </Field>
                  <Field label="File Path">
                    <input value={fileName} onChange={(e) => setFileName(e.target.value)} className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono outline-none focus:border-ring transition-colors" />
                  </Field>
                  <Field label="Commit Message">
                    <input value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors" />
                  </Field>
                </div>
              )}
            </>
          )}
        </div>

        {isConnected && pushState === "idle" && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">Cancel</button>
            <button onClick={handlePush} disabled={(mode === "new" && !repoName.trim()) || (mode === "existing" && !selectedRepo)} className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-foreground text-background font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
              <GithubIcon className="w-3.5 h-3.5" />{mode === "new" ? "Create & Push" : "Push Code"}
            </button>
          </div>
        )}

        {isConnected && (pushState === "success" || pushState === "error") && (
          <div className="flex items-center justify-end px-5 py-4 border-t border-border shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">Close</button>
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
