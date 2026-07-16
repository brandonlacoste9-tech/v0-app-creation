"use client";

import { useState, useEffect } from "react";
import { X, Check, Zap, Crown, LogIn, Sparkles, Shield, Rocket, ArrowRight, Star } from "lucide-react";
import { startGitHubAuth } from "@/lib/api-client";
import type { UserInfo } from "@/lib/types";
import { PAID_PLANS, type PaidPlanId } from "@/lib/pricing";

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
  const [mounted, setMounted] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState<PaidPlanId | null>(null);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    if (open) {
      setMounted(false);
      setPromoSuccess(false);
      setPromoError("");
      setCheckoutError("");
      requestAnimationFrame(() => setMounted(true));
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

  if (!open) return null;

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
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose} />
      <div
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[calc(100vw-1.5rem)] md:max-w-4xl bg-card border border-border rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden transition-all duration-300 ${
          mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        <div className="relative overflow-hidden px-6 py-6 border-b border-border shrink-0">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              background: "linear-gradient(135deg, #10b981 0%, #6366f1 50%, #f59e0b 100%)",
            }}
          />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald/20 to-emerald/5 border border-emerald/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-emerald" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  AdGenAI Plans
                  <span className="px-1.5 py-0.5 rounded border border-border/50 bg-background/50 text-[9px] text-muted-foreground font-mono uppercase tracking-widest">
                    CAD
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Builder · Pro · Max — monthly subscriptions
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {userInfo && userInfo.plan === "free" && (
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground">Today&apos;s usage</span>
                <span className="font-mono text-foreground">
                  {userInfo.generationsToday}/{userInfo.generationsLimit ?? 5} generations
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald transition-all"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>
          )}

          {needsAuth && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
              <p className="text-foreground mb-3">
                Sign in with GitHub to upgrade — your Pro plan syncs automatically after payment.
              </p>
              <button
                onClick={handleSignIn}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign in with GitHub
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Free */}
            <div className="rounded-xl border border-border p-4 bg-background/30 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                <h3 className="text-sm font-bold">Free</h3>
              </div>
              <p className="text-2xl font-bold">
                $0<span className="text-xs font-normal text-muted-foreground">/mo</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-[11px] text-muted-foreground flex-1">
                <li className="flex gap-1.5"><Check className="w-3 h-3 text-emerald shrink-0" /> 5 gens / day</li>
                <li className="flex gap-1.5"><Check className="w-3 h-3 text-emerald shrink-0" /> 3 projects</li>
                <li className="flex gap-1.5"><Check className="w-3 h-3 text-emerald shrink-0" /> Free models</li>
              </ul>
              <button disabled className="mt-4 w-full py-2 rounded-lg border border-border text-[11px] text-muted-foreground">
                Current
              </button>
            </div>

            {PAID_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-xl p-4 flex flex-col relative ${
                  plan.popular
                    ? "border-2 border-emerald bg-emerald/[0.03]"
                    : "border border-border bg-background/30"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-emerald text-zinc-950 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                    <Sparkles className="w-2.5 h-2.5" />
                    Popular
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  {plan.id === "max" ? (
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                  ) : plan.id === "pro" ? (
                    <Rocket className="w-3.5 h-3.5 text-emerald" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 text-sky-400" />
                  )}
                  <h3 className="text-sm font-bold">{plan.name}</h3>
                </div>
                <p className="text-2xl font-bold">
                  ${plan.priceCad}
                  <span className="text-xs font-normal text-muted-foreground">/mo CAD</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{plan.blurb}</p>
                <ul className="mt-3 space-y-1.5 text-[11px] flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-1.5 text-foreground/90">
                      <Check className="w-3 h-3 text-emerald shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={checkoutBusy !== null || userInfo?.plan === "pro"}
                  className={`mt-4 w-full py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 ${
                    plan.popular
                      ? "bg-emerald text-zinc-950 hover:bg-emerald/90"
                      : "bg-foreground text-background hover:opacity-90"
                  }`}
                >
                  {checkoutBusy === plan.id ? (
                    "Opening Stripe…"
                  ) : userInfo?.plan === "pro" ? (
                    "Active plan"
                  ) : (
                    <>
                      Get {plan.name}
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          {checkoutError && (
            <p className="text-center text-xs text-destructive">{checkoutError}</p>
          )}

          <p className="text-[10px] text-muted-foreground text-center">
            Prices in CAD · Cancel anytime · Webhook unlocks Pro after payment · Promo codes still work
          </p>

          {/* Promo */}
          <div className="border-t border-border pt-4">
            {!promoOpen ? (
              <button
                onClick={() => setPromoOpen(true)}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Have a promo code?
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="NORTH-PRO"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  onClick={handleApplyPromo}
                  disabled={isApplying}
                  className="px-4 py-2 rounded-lg bg-emerald text-zinc-950 text-xs font-bold disabled:opacity-50"
                >
                  {isApplying ? "Applying…" : promoSuccess ? "Unlocked!" : "Apply"}
                </button>
              </div>
            )}
            {promoError && <p className="mt-2 text-xs text-destructive">{promoError}</p>}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <div className="flex -space-x-2">
              {TESTIMONIALS.map((t, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: i === 0 ? "#6366f1" : i === 1 ? "#10b981" : "#f59e0b" }}
                >
                  {t.avatar}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-yellow-500 text-yellow-500" />
              ))}
            </div>
            <span>&quot;{TESTIMONIALS[activeTestimonial].text}&quot;</span>
          </div>
        </div>
      </div>
    </>
  );
}
