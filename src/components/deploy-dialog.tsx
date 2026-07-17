"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { GitHubStatus } from "@/lib/types";
import { deployProject } from "@/lib/api-client";
import {
  Rocket, Check, AlertCircle, Loader2, ExternalLink,
  GitBranch, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { GithubIcon } from "@/components/icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DeployState = "idle" | "deploying" | "success" | "error";
type DeployStep = "creating-repo" | "pushing-files" | "ready";

interface DeployDialogProps {
  open: boolean;
  onClose: () => void;
  code: string;
  title: string;
  githubStatus: GitHubStatus | undefined;
  onConnectGitHub: () => void;
  byobSchema?: import("@/lib/byob/types").DatabaseSchemaMap | null;
}

export function DeployDialog({
  open, onClose, code, title, githubStatus, onConnectGitHub, byobSchema = null,
}: DeployDialogProps) {
  const [deployState, setDeployState] = useState<DeployState>("idle");
  const [deployStep, setDeployStep] = useState<DeployStep>("creating-repo");
  const [repoUrl, setRepoUrl] = useState("");
  const [vercelUrl, setVercelUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [repoName, setRepoName] = useState("");

  useEffect(() => {
    if (open) {
      const slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 40) || "Shipboard-deploy";
      setRepoName(slug);
      setDeployState("idle");
      setRepoUrl("");
      setVercelUrl("");
      setErrorMessage("");
    }
  }, [open, title]);

  const handleDeploy = useCallback(async () => {
    setDeployState("deploying");
    setDeployStep("creating-repo");
    setErrorMessage("");

    try {
      setTimeout(() => setDeployStep("pushing-files"), 1500);

      const result = await deployProject({
        code,
        title,
        repoName,
        byobSchema: byobSchema || null,
      });

      setRepoUrl(result.repoUrl);
      setVercelUrl(result.vercelImportUrl);
      setDeployStep("ready");
      setDeployState("success");
      toast.success("Repo ready — open Vercel to go live");
    } catch (err: unknown) {
      setDeployState("error");
      const msg = err instanceof Error ? err.message : "Deploy failed";
      setErrorMessage(msg);
      toast.error(msg);
    }
  }, [code, title, repoName, byobSchema]);

  const isConnected = githubStatus?.connected;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && deployState !== "deploying") onClose();
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Rocket className="h-4 w-4 text-muted-foreground" />
            Deploy to Vercel
          </DialogTitle>
          <DialogDescription className="text-xs">
            Full Vite project → GitHub → one-click Vercel import
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {!isConnected ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted/50">
                <GithubIcon className="h-7 w-7 text-foreground" />
              </div>
              <h3 className="mb-2 font-medium text-foreground">Connect GitHub to ship</h3>
              <p className="mx-auto mb-6 max-w-xs text-sm text-muted-foreground">
                Connect with OAuth, then we create a full Vite repo and open Vercel import.
              </p>
              <Button onClick={onConnectGitHub}>
                <GithubIcon className="h-4 w-4" />
                Connect GitHub
              </Button>
            </div>
          ) : deployState === "deploying" ? (
            <div className="space-y-6 py-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                  <Loader2 className="h-6 w-6 animate-spin text-foreground" />
                </div>
                <h3 className="mb-1 font-medium text-foreground">Deploying your project</h3>
                <p className="text-sm text-muted-foreground">Usually about 10 seconds</p>
              </div>
              <div className="space-y-3">
                <StepRow
                  label="Create GitHub repository"
                  status={deployStep === "creating-repo" ? "active" : "done"}
                />
                <StepRow
                  label="Push Next.js project files"
                  status={
                    deployStep === "pushing-files"
                      ? "active"
                      : deployStep === "ready"
                        ? "done"
                        : "pending"
                  }
                />
                <StepRow
                  label="Ready to deploy on Vercel"
                  status={deployStep === "ready" ? "done" : "pending"}
                />
              </div>
            </div>
          ) : deployState === "success" ? (
            <div className="space-y-5 py-2">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald/10">
                  <Check className="h-6 w-6 text-emerald" />
                </div>
                <h3 className="mb-1 font-medium text-foreground">Project ready to deploy</h3>
                <p className="text-sm text-muted-foreground">Code is on GitHub. One click to go live.</p>
              </div>
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 transition-colors hover:bg-accent"
              >
                <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{repoName}</div>
                  <div className="text-xs text-muted-foreground">GitHub repository</div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
              <Button asChild className="w-full" size="lg">
                <a href={vercelUrl} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-4 w-4" />
                  Deploy on Vercel
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Vercel auto-detects Vite and deploys in under a minute.
              </p>
            </div>
          ) : deployState === "error" ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="mb-2 font-medium text-foreground">Deploy failed</h3>
              <p className="mb-4 text-sm text-destructive">{errorMessage}</p>
              <Button variant="secondary" onClick={() => setDeployState("idle")}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <Rocket className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium text-foreground">What happens</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Creates a GitHub repo with Vite + React + Tailwind, then opens Vercel to deploy it.
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Repository name</label>
                <Input
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, "-"))}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-foreground">Files that will be created</div>
                <div className="space-y-0.5 rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-xs text-muted-foreground">
                  {[
                    "src/Component.tsx",
                    "src/main.tsx",
                    "src/index.css",
                    "index.html",
                    "package.json",
                    "vite.config.ts",
                    "tailwind.config.js",
                  ].map((f) => (
                    <div key={f}>{f}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {isConnected && deployState === "idle" && (
          <DialogFooter className="shrink-0 border-t border-border px-5 py-4 sm:justify-end">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleDeploy} disabled={!repoName.trim()}>
              <Rocket className="h-3.5 w-3.5" />
              Deploy
            </Button>
          </DialogFooter>
        )}

        {isConnected && (deployState === "success" || deployState === "error") && (
          <DialogFooter className="shrink-0 border-t border-border px-5 py-4">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepRow({
  label,
  status,
}: {
  label: string;
  status: "pending" | "active" | "done";
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
          status === "done" && "border-emerald/40 bg-emerald/10",
          status === "active" && "border-orange-500/40 bg-orange-500/10",
          status === "pending" && "border-border bg-muted/40"
        )}
      >
        {status === "done" ? (
          <Check className="h-3 w-3 text-emerald" />
        ) : status === "active" ? (
          <Loader2 className="h-3 w-3 animate-spin text-orange-400" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        )}
      </div>
      <span
        className={cn(
          "text-sm",
          status === "pending" ? "text-muted-foreground/60" : "text-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}
