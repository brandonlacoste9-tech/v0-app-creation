"use client";

import { useState, useEffect } from "react";
import { Check, Zap, Crown, LogIn, Sparkles, Shield, Rocket, ArrowRight, Star } from "lucide-react";
import { startGitHubAuth } from "@/lib/api-client";
import type { UserInfo } from "@/lib/types";
import { PAID_PLANS, type PaidPlanId } from "@/lib/pricing";
import { freePlanFeatureBullets, planRank } from "@/lib/plans";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  needsAuth?: boolean;
  userInfo?: UserInfo | null;
  onPlanUpdate?: (plan: string) => void;
}

const TESTIMONIALS = [
  { name: "Alex R.", role: "Indie Hacker", text: "Shipped 3 landing pages in one afternoon. AdGenAI paid for itself on day one.", avatar: "A" },
  { name: "Sarah K.", role: "Freelance Dev", text: "My clients can't tell this wasn't hand-coded. The quality is insane.", avatar: "S" },
  { name: "Mike T.", role: "Startup CTO", text: "We prototyped our entire MVP UI in a single sprint using AdGenAI Pro.", avatar: "M" },
];

export function UpgradeModal({ open, onClose, needsAuth, userInfo, onPlanUpdate }: UpgradeModalProps) {
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState<PaidPlanId | null>(null);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    if (open) {
      setPromoSuccess(false);
      setPromoError("");
      setCheckoutError("");
      if (
        userInfo?.plan === "free" &&
        userInfo.generationsLimit != null &&
        userInfo.generationsToday >= (userInfo.generationsLimit || 5)
      ) {
        setPromoOpen(true);
      }
    }
  }, [open, userInfo?.plan, userInfo?.generationsToday, userInfo?.generationsLimit]);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [open]);

  const handleSignIn = async () => {
    try {
      const { url } = await startGitHubAuth();
      window.open(url, "github-auth", "width=600,height=700,popup=yes");
    } catch (err) {
      console.error("Failed to start GitHub auth:", err);
    }
  };

  const handleUpgrade = async (plan: PaidPlanId) => {
    setCheckoutError("");
    if (!userInfo?.connected) {
      setCheckoutError("Sign in with GitHub first — Stripe checkout syncs your plan.");
      return;
    }
    setCheckoutBusy(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setCheckoutError(data.error || "Checkout failed. Try again or use a promo code.");
    } catch {
      setCheckoutError("Connection failed");
    } finally {
      setCheckoutBusy(null);
    }
  };

  const usagePercent = userInfo
    ? Math.min(100, Math.round(((userInfo.generationsToday ?? 0) / (userInfo.generationsLimit || 5)) * 100))
    : 0;

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || isApplying) return;
    setIsApplying(true);
    setPromoError("");

    try {
      const res = await fetch("/api/upgrade/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPromoError(data.error || "Invalid code");
      } else {
        setPromoSuccess(true);
        if (onPlanUpdate) onPlanUpdate(data.plan);
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1500);
      }
    } catch {
      setPromoError("Connection failed");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl">
        <DialogHeader className="relative shrink-0 overflow-hidden border-b border-border px-6 py-5 text-left">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              background: "linear-gradient(135deg, #10b981 0%, #6366f1 50%, #f59e0b 100%)",
            }}
          />
          <div className="relative flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald/20 bg-emerald/10">
              <Crown className="h-5 w-5 text-emerald" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg">
                AdGenAI Plans
                <Badge variant="secondary" className="normal-case tracking-normal">
                  CAD
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Builder · Pro · Max — monthly subscriptions
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {userInfo && userInfo.generationsLimit != null && (
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Today&apos;s usage
                  {userInfo.plan !== "free" ? ` · ${userInfo.plan}` : ""}
                </span>
                <span className="font-mono text-foreground">
                  {userInfo.generationsToday}/{userInfo.generationsLimit} generations
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    usagePercent >= 100 ? "bg-amber-500" : "bg-emerald"
                  )}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              {usagePercent >= 100 && (
                <p className="mt-2 text-[11px] text-amber-400/90">
                  Daily cap reached — pick a higher plan below for more gens.
                </p>
              )}
            </div>
          )}

          {(needsAuth || !userInfo?.connected) && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
              <p className="mb-3 text-foreground">
                Sign in with GitHub to upgrade — your plan syncs automatically after payment.
              </p>
              <Button size="sm" onClick={handleSignIn}>
                <LogIn className="h-3.5 w-3.5" />
                Sign in with GitHub
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col rounded-xl border border-border bg-background/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-sm font-bold">Free</h3>
              </div>
              <p className="text-2xl font-bold">
                $0<span className="text-xs font-normal text-muted-foreground">/mo</span>
              </p>
              <ul className="mt-3 flex-1 space-y-1.5 text-[11px] text-muted-foreground">
                {freePlanFeatureBullets().map((f) => (
                  <li key={f} className="flex gap-1.5">
                    <Check className="h-3 w-3 shrink-0 text-emerald" /> {f}
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" className="mt-4" disabled>
                {userInfo?.plan === "free" || !userInfo ? "Current" : "Free"}
              </Button>
            </div>

            {PAID_PLANS.map((plan) => {
              const current = userInfo?.plan === plan.id;
              const lower = planRank(userInfo?.plan) > planRank(plan.id);
              return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl p-4 ${
                  plan.popular
                    ? "border-2 border-emerald bg-emerald/[0.03]"
                    : "border border-border bg-background/30"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-emerald px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-950">
                    <Sparkles className="h-2.5 w-2.5" />
                    Popular
                  </div>
                )}
                <div className="mb-2 flex items-center gap-2">
                  {plan.id === "max" ? (
                    <Crown className="h-3.5 w-3.5 text-amber-400" />
                  ) : plan.id === "pro" ? (
                    <Rocket className="h-3.5 w-3.5 text-emerald" />
                  ) : (
                    <Zap className="h-3.5 w-3.5 text-sky-400" />
                  )}
                  <h3 className="text-sm font-bold">{plan.name}</h3>
                </div>
                <p className="text-2xl font-bold">
                  ${plan.priceCad}
                  <span className="text-xs font-normal text-muted-foreground">/mo CAD</span>
                </p>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{plan.blurb}</p>
                <ul className="mt-3 flex-1 space-y-1.5 text-[11px]">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-1.5 text-foreground/90">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant={plan.popular ? "brand" : "default"}
                  className="mt-4"
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={checkoutBusy !== null || current || lower}
                >
                  {checkoutBusy === plan.id ? (
                    "Opening Stripe…"
                  ) : current ? (
                    "Current plan"
                  ) : lower ? (
                    "Included below"
                  ) : (
                    <>
                      Get {plan.name}
                      <ArrowRight className="h-3 w-3" />
                    </>
                  )}
                </Button>
              </div>
            );
            })}
          </div>

          {checkoutError && (
            <p className="text-center text-xs text-destructive">{checkoutError}</p>
          )}

          <p className="text-center text-[10px] text-muted-foreground">
            Prices in CAD · Cancel anytime · Webhook sets Builder / Pro / Max from checkout · Promo → Pro
          </p>

          <div className="border-t border-border pt-4">
            {!promoOpen ? (
              <button
                type="button"
                onClick={() => setPromoOpen(true)}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Have a promo code?
              </button>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="NORTH-PRO"
                  className="flex-1"
                />
                <Button
                  variant="brand"
                  size="sm"
                  onClick={handleApplyPromo}
                  disabled={isApplying}
                >
                  {isApplying ? "Applying…" : promoSuccess ? "Unlocked!" : "Apply"}
                </Button>
              </div>
            )}
            {promoError && <p className="mt-2 text-xs text-destructive">{promoError}</p>}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <div className="flex -space-x-2">
              {TESTIMONIALS.map((t, i) => (
                <div
                  key={i}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card text-[9px] font-bold text-white"
                  style={{ background: i === 0 ? "#6366f1" : i === 1 ? "#10b981" : "#f59e0b" }}
                >
                  {t.avatar}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              ))}
            </div>
            <span className="line-clamp-1">&quot;{TESTIMONIALS[activeTestimonial].text}&quot;</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
