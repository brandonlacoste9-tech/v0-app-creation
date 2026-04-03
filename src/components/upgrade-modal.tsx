"use client";

import { useState } from "react";
import { X, Check, Zap, Crown, LogIn } from "lucide-react";
import { startGitHubAuth } from "@/lib/api-client";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  needsAuth?: boolean;
}

const FREE_FEATURES = [
  { label: "5 generations / day", included: true },
  { label: "3 projects", included: true },
  { label: "Groq provider only", included: true },
  { label: "Download ZIP / HTML", included: true },
  { label: "Deploy to Vercel", included: false },
  { label: "Push to GitHub", included: false },
  { label: "All AI providers", included: false },
  { label: "Unlimited generations", included: false },
];

const PRO_FEATURES = [
  { label: "Unlimited generations", included: true },
  { label: "Unlimited projects", included: true },
  { label: "All 5 AI providers", included: true },
  { label: "Download ZIP / HTML", included: true },
  { label: "Deploy to Vercel", included: true },
  { label: "Push to GitHub", included: true },
  { label: "Priority support", included: true },
  { label: "Early access to features", included: true },
];

export function UpgradeModal({ open, onClose, needsAuth }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSignIn = async () => {
    try {
      const { url } = await startGitHubAuth();
      window.open(url, "github-auth", "width=600,height=700,popup=yes");
    } catch (err) {
      console.error("Failed to start GitHub auth:", err);
    }
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No checkout URL:", data.error);
        setLoading(false);
      }
    } catch (err) {
      console.error("Checkout failed:", err);
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl animate-fadeIn max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald/10 flex items-center justify-center">
              <Crown className="w-4 h-4 text-emerald" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Upgrade to Pro</h2>
              <p className="text-xs text-muted-foreground">Unlock the full power of AdGenAI</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Plans comparison */}
        <div className="p-6 overflow-y-auto flex-1">
          {needsAuth && (
            <div className="mb-5 p-4 rounded-xl border border-ring bg-accent/30">
              <p className="text-sm text-foreground font-medium mb-3">Sign in to continue</p>
              <p className="text-xs text-muted-foreground mb-4">Create a free account with GitHub to keep using AdGenAI, or upgrade to Pro for unlimited access.</p>
              <button
                onClick={handleSignIn}
                className="w-full py-2.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                Sign in with GitHub
              </button>
              <p className="text-[11px] text-muted-foreground text-center mt-2">Then upgrade to Pro for $15/mo</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {/* Free Plan */}
            <div className="rounded-xl border border-border p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">Free</h3>
                <div className="mt-1">
                  <span className="text-2xl font-bold text-foreground">$0</span>
                  <span className="text-xs text-muted-foreground">/month</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Get started building</p>
              </div>
              <div className="space-y-2.5">
                {FREE_FEATURES.map((f) => (
                  <div key={f.label} className="flex items-center gap-2 text-xs">
                    {f.included ? (
                      <Check className="w-3.5 h-3.5 text-emerald shrink-0" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={f.included ? "text-foreground" : "text-muted-foreground/50"}>{f.label}</span>
                  </div>
                ))}
              </div>
              <button
                disabled
                className="mt-5 w-full py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground cursor-default"
              >
                Current plan
              </button>
            </div>

            {/* Pro Plan */}
            <div className="rounded-xl border-2 border-emerald p-5 relative">
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">
                Recommended
              </div>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground">Pro</h3>
                <div className="mt-1">
                  <span className="text-2xl font-bold text-foreground">$15</span>
                  <span className="text-xs text-muted-foreground">/month</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">For serious builders</p>
              </div>
              <div className="space-y-2.5">
                {PRO_FEATURES.map((f) => (
                  <div key={f.label} className="flex items-center gap-2 text-xs">
                    <Check className="w-3.5 h-3.5 text-emerald shrink-0" />
                    <span className="text-foreground">{f.label}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="mt-5 w-full py-2 rounded-lg bg-emerald text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                {loading ? "Redirecting..." : "Upgrade Now"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">Cancel anytime. No questions asked.</p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </>
  );
}
