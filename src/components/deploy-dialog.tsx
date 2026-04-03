"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { GitHubStatus } from "@/lib/types";
import { deployProject } from "@/lib/api-client";
import {
  X, Rocket, Check, AlertCircle, Loader2, ExternalLink,
  GitBranch, Globe,
} from "lucide-react";
import { GithubIcon } from "@/components/icons";

type DeployState = "idle" | "deploying" | "success" | "error";
type DeployStep = "creating-repo" | "pushing-files" | "ready";

interface DeployDialogProps {
  open: boolean;
  onClose: () => void;
  code: string;
  title: string;
  githubStatus: GitHubStatus | undefined;
  onConnectGitHub: () => void;
}

export function DeployDialog({
  open, onClose, code, title, githubStatus, onConnectGitHub,
}: DeployDialogProps) {
  const [deployState, setDeployState] = useState<DeployState>("idle");
  const [deployStep, setDeployStep] = useState<DeployStep>("creating-repo");
  const [repoUrl, setRepoUrl] = useState("");
  const [vercelUrl, setVercelUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [repoName, setRepoName] = useState("");

  useEffect(() => {
    if (open) {
      const slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 40) || "adgenai-deploy";
      setRepoName(slug);
      setDeployState("idle");
      setRepoUrl("");
      setVercelUrl("");
      setErrorMessage("");
    }
  }, [open, title]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && deployState !== "deploying") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose, deployState]);

  const handleDeploy = useCallback(async () => {
    setDeployState("deploying");
    setDeployStep("creating-repo");
    setErrorMessage("");

    try {
      // Brief delay for UX so user sees the step
      setTimeout(() => setDeployStep("pushing-files"), 1500);

      const result = await deployProject({ code, title, repoName });

      setRepoUrl(result.repoUrl);
      setVercelUrl(result.vercelImportUrl);
      setDeployStep("ready");
      setDeployState("success");
    } catch (err: unknown) {
      setDeployState("error");
      setErrorMessage(err instanceof Error ? err.message : "Deploy failed");
    }
  }, [code, title, repoName]);

  if (!open) return null;
  const isConnected = githubStatus?.connected;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={deployState !== "deploying" ? onClose : undefined} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl max-h-[85vh] flex flex-col animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Deploy to Vercel</h2>
          </div>
          {deployState !== "deploying" && (
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Not connected */}
          {!isConnected ? (
            <div className="text-center py-8">
              <GithubIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-foreground font-medium mb-2">Connect GitHub to deploy</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
                Sign in with GitHub so we can create a repo and deploy your project.
              </p>
              <button onClick={onConnectGitHub} className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-lg font-medium text-sm hover:opacity-90 transition-opacity">
                <GithubIcon className="w-4 h-4" />Connect GitHub
              </button>
            </div>
          ) : deployState === "deploying" ? (
            /* Deploying progress */
            <div className="py-6 space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-6 h-6 text-foreground animate-spin" />
                </div>
                <h3 className="text-foreground font-medium mb-1">Deploying your project</h3>
                <p className="text-muted-foreground text-sm">This takes about 10 seconds</p>
              </div>

              <div className="space-y-3">
                <StepRow
                  label="Create GitHub repository"
                  status={deployStep === "creating-repo" ? "active" : "done"}
                />
                <StepRow
                  label="Push project files (9 files)"
                  status={deployStep === "pushing-files" ? "active" : deployStep === "ready" ? "done" : "pending"}
                />
                <StepRow
                  label="Ready to deploy on Vercel"
                  status={deployStep === "ready" ? "done" : "pending"}
                />
              </div>
            </div>
          ) : deployState === "success" ? (
            /* Success */
            <div className="py-4 space-y-5">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-emerald/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-emerald" />
                </div>
                <h3 className="text-foreground font-medium mb-1">Project ready to deploy</h3>
                <p className="text-muted-foreground text-sm">Your code is on GitHub. One click to go live.</p>
              </div>

              {/* Repo link */}
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-background hover:bg-accent transition-colors group"
              >
                <GitBranch className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{repoName}</div>
                  <div className="text-xs text-muted-foreground">GitHub repository</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </a>

              {/* Deploy to Vercel CTA */}
              <a
                href={vercelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-foreground text-background rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
              >
                <Globe className="w-4 h-4" />
                Deploy on Vercel
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <p className="text-[11px] text-muted-foreground text-center">
                Click above to import the project into Vercel. It auto-detects Vite and deploys in under a minute.
              </p>
            </div>
          ) : deployState === "error" ? (
            /* Error */
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-foreground font-medium mb-2">Deploy failed</h3>
              <p className="text-destructive text-sm mb-4">{errorMessage}</p>
              <button onClick={() => setDeployState("idle")} className="px-4 py-2 text-sm rounded-lg bg-accent text-foreground hover:opacity-90 transition-opacity">
                Try again
              </button>
            </div>
          ) : (
            /* Idle — ready to deploy */
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-background">
                  <Rocket className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-foreground">What happens</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Creates a GitHub repo with a full Vite + React + Tailwind project, then opens Vercel to deploy it.
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Repository name</label>
                  <input
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, "-"))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-foreground">Files that will be created</div>
                  <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono space-y-0.5">
                    <div>src/Component.tsx</div>
                    <div>src/main.tsx</div>
                    <div>src/index.css</div>
                    <div>index.html</div>
                    <div>package.json</div>
                    <div>tsconfig.json</div>
                    <div>vite.config.ts</div>
                    <div>tailwind.config.js</div>
                    <div>postcss.config.js</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {isConnected && deployState === "idle" && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              Cancel
            </button>
            <button
              onClick={handleDeploy}
              disabled={!repoName.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-foreground text-background font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Rocket className="w-3.5 h-3.5" />
              Deploy
            </button>
          </div>
        )}

        {isConnected && (deployState === "success" || deployState === "error") && (
          <div className="flex items-center justify-end px-5 py-4 border-t border-border shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              Close
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function StepRow({ label, status }: { label: string; status: "pending" | "active" | "done" }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      {status === "done" ? (
        <div className="w-5 h-5 rounded-full bg-emerald/20 flex items-center justify-center">
          <Check className="w-3 h-3 text-emerald" />
        </div>
      ) : status === "active" ? (
        <Loader2 className="w-5 h-5 text-foreground animate-spin" />
      ) : (
        <div className="w-5 h-5 rounded-full border border-border" />
      )}
      <span className={cn("text-sm", status === "pending" ? "text-muted-foreground" : "text-foreground")}>
        {label}
      </span>
    </div>
  );
}
