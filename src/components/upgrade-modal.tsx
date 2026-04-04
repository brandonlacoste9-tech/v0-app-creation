"use client";

import { useState, useEffect } from "react";
import { X, Check, Zap, Crown, LogIn, Sparkles, Shield, Rocket, ArrowRight, Star, TrendingUp } from "lucide-react";
import { startGitHubAuth } from "@/lib/api-client";
import type { UserInfo } from "@/lib/types";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  needsAuth?: boolean;
  userInfo?: UserInfo | null;
  onPlanUpdate?: (plan: string) => void;
}

const FREE_FEATURES = [
  { label: "5 generations / day", included: true },
  { label: "3 projects", included: true },
  { label: "Groq provider only", included: true },
  { label: "Download ZIP / HTML", included: true },
  { label: "Community support", included: true },
  { label: "Deploy to Vercel", included: false },
  { label: "Push to GitHub", included: false },
  { label: "All AI providers", included: false },
  { label: "Unlimited generations", included: false },
  { label: "Brand Kit", included: false },
];

const PRO_FEATURES = [
  { label: "Unlimited generations", included: true, highlight: true },
  { label: "Turbo-Mode GPU Priority", included: true, highlight: true },
  { label: "All premium AI models", included: true, highlight: true },
  { label: "Live Deployment (Vercel)", included: true },
  { label: "Git-Sync (Push to Hub)", included: true },
  { label: "Full Codebase Exports", included: true },
  { label: "Commercial License", included: true },
  { label: "Custom Team Branding", included: true },
  { label: "Priority API Access", included: true },
  { label: "System-Level Prompts", included: true },
];

const TESTIMONIALS = [
  { name: "Alex R.", role: "Indie Hacker", text: "Shipped 3 landing pages in one afternoon. AdGenAI paid for itself on day one.", avatar: "A" },
  { name: "Sarah K.", role: "Freelance Dev", text: "My clients can't tell this wasn't hand-coded. The quality is insane.", avatar: "S" },
  { name: "Mike T.", role: "Startup CTO", text: "We prototyped our entire MVP UI in a single sprint using AdGenAI Pro.", avatar: "M" },
];

export function UpgradeModal({ open, onClose, needsAuth, userInfo, onPlanUpdate }: UpgradeModalProps) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(false);
      requestAnimationFrame(() => setMounted(true));
    }
  }, [open]);

  // Auto-rotate testimonials
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

  const PAYMENT_URL = "https://buy.stripe.com/4gM9ASaxD2hL0hw81r1Fe0C";
  const monthlyPrice = 15;
  const annualPrice = 12;
  const savingsPercent = Math.round((1 - annualPrice / monthlyPrice) * 100);
  const price = billing === "monthly" ? monthlyPrice : annualPrice;

  const handleUpgrade = () => {
    window.open(PAYMENT_URL, "_blank");
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
          window.location.reload(); // Refresh to update all provider states
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
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[calc(100vw-1.5rem)] md:max-w-3xl bg-card border border-border rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden transition-all duration-300 ${
          mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        {/* Animated gradient header */}
        <div className="relative overflow-hidden px-6 py-6 border-b border-border shrink-0">
          <div className="absolute inset-0 opacity-[0.07]" style={{
            background: "linear-gradient(135deg, #10b981 0%, #6366f1 50%, #f59e0b 100%)",
            animation: "gradientShift 6s ease infinite",
          }} />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald/20 to-emerald/5 border border-emerald/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-emerald" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  AdGenAI Pro
                  <span className="px-1.5 py-0.5 rounded border border-border/50 bg-background/50 text-[9px] text-muted-foreground font-mono uppercase tracking-widest">BETA</span>
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-emerald font-bold uppercase tracking-wider flex items-center gap-1">
                    <Zap className="w-3 h-3 fill-emerald" />
                    Special Early Bird Offer
                  </span>
                  <div className="w-px h-2 bg-border" />
                  <span className="text-[10px] text-muted-foreground">Limited time: $15/mo</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* First 100 Offer Banner */}
          <div className="relative mt-4 p-3 rounded-xl bg-emerald/10 border border-emerald/20 overflow-hidden group">
            <div className="absolute top-0 right-0 p-1 opacity-20 transition-opacity group-hover:opacity-40">
              <Crown className="w-12 h-12 text-emerald rotate-12" />
            </div>
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-[11px] font-bold text-foreground uppercase tracking-tight">
                  EARLY BIRD SPECIAL — FIRST 100 USERS
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Join the Beta and lock in your price for life. Only $15/month instead of $49.
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm font-black text-emerald font-mono leading-none">82/100</div>
                <div className="text-[8px] text-muted-foreground uppercase font-bold">SLOTS LEFT</div>
              </div>
            </div>
          </div>

          {/* Usage warning for free users */}
          {userInfo && userInfo.plan === "free" && userInfo.generationsLimit && (
            <div className="relative mt-4 p-3 rounded-xl bg-background/50 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                  Today&apos;s usage
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {userInfo.generationsToday}/{userInfo.generationsLimit} generations
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${usagePercent}%`,
                    background: usagePercent > 80
                      ? "linear-gradient(90deg, #ef4444, #f97316)"
                      : usagePercent > 50
                        ? "linear-gradient(90deg, #f59e0b, #eab308)"
                        : "linear-gradient(90deg, #10b981, #34d399)",
                  }}
                />
              </div>
              {usagePercent >= 80 && (
                <p className="text-[11px] text-destructive mt-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {usagePercent >= 100 ? "You've hit today's limit." : "Almost out of generations."}
                  {" "}Upgrade for unlimited.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sign-in banner for unauthenticated users */}
        {needsAuth && (
          <div className="mx-6 mt-4 p-4 rounded-xl border border-ring/30 bg-accent/20">
            <p className="text-sm text-foreground font-medium mb-1">Sign in to continue</p>
            <p className="text-xs text-muted-foreground mb-3">Create a free account with GitHub to keep using AdGenAI, or upgrade to Pro for unlimited access.</p>
            <button
              onClick={handleSignIn}
              className="w-full py-2.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <LogIn className="w-4 h-4" />
              Sign in with GitHub
            </button>
          </div>
        )}

        {/* Scrollable content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {/* Billing toggle */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-background border border-border">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  billing === "monthly"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  billing === "annual"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Annual
                <span className="px-1.5 py-0.5 rounded-md bg-emerald/20 text-emerald text-[9px] font-bold">
                  -{savingsPercent}%
                </span>
              </button>
            </div>
          </div>

          {/* Plans comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Free Plan */}
            <div className="rounded-xl border border-border p-5 bg-background/30">
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                    <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Free</h3>
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-foreground">$0</span>
                  <span className="text-xs text-muted-foreground ml-1">/month</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Get started building UI with AI</p>
              </div>
              <div className="space-y-2.5 mb-5">
                {FREE_FEATURES.map((f) => (
                  <div key={f.label} className="flex items-center gap-2.5 text-xs">
                    {f.included ? (
                      <div className="w-4 h-4 rounded-full bg-emerald/10 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-emerald" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <X className="w-2.5 h-2.5 text-muted-foreground/40" />
                      </div>
                    )}
                    <span className={f.included ? "text-foreground" : "text-muted-foreground/50 line-through"}>
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>
              <button
                disabled
                className="w-full py-2.5 rounded-lg border border-border text-xs font-medium text-muted-foreground cursor-default"
              >
                Current plan
              </button>
            </div>

            {/* Pro Plan */}
            <div className="rounded-xl border-2 border-emerald p-5 relative bg-emerald/[0.02]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-emerald text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg shadow-emerald/20">
                <Sparkles className="w-3 h-3" />
                Most Popular
              </div>
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald/10 flex items-center justify-center">
                    <Rocket className="w-3.5 h-3.5 text-emerald" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Pro</h3>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-foreground">${price}</span>
                  <span className="text-xs text-muted-foreground">/month</span>
                  {billing === "annual" && (
                    <span className="text-xs text-muted-foreground line-through ml-1">${monthlyPrice}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Lifetime price lock for Early Bird users
                </p>
              </div>
              <div className="space-y-2.5 mb-5">
                {PRO_FEATURES.map((f) => (
                  <div key={f.label} className="flex items-center gap-2.5 text-xs">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                      f.highlight ? "bg-emerald/20" : "bg-emerald/10"
                    }`}>
                      <Check className="w-2.5 h-2.5 text-emerald" />
                    </div>
                    <span className={`text-foreground ${f.highlight ? "font-semibold" : ""}`}>
                      {f.label}
                    </span>
                    {f.highlight && (
                      <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald/10 text-emerald uppercase">
                        Pro
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={handleUpgrade}
                className="w-full py-3.5 rounded-xl bg-emerald text-primary-foreground text-xs font-black hover:opacity-90 active:scale-[0.98] transition-all flex flex-col items-center gap-1 shadow-lg shadow-emerald/20 group"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Claim Early Bird — ${price}/mo
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
                <span className="text-[10px] opacity-80 font-medium">Limited slots left: 82/100</span>
              </button>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Cancel anytime · No questions asked · 7-day money-back guarantee
              </p>
            </div>
          </div>

          {/* Social Proof / Testimonials */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex -space-x-2">
                {TESTIMONIALS.map((t, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[9px] font-bold"
                    style={{
                      background: i === 0 ? "#6366f1" : i === 1 ? "#10b981" : "#f59e0b",
                      color: "#fff",
                    }}
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
              <span className="text-[11px] text-muted-foreground">Loved by 2,400+ developers</span>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-border bg-background/50 p-4 min-h-[72px]">
              {TESTIMONIALS.map((t, i) => (
                <div
                  key={i}
                  className={`transition-all duration-500 ${
                    i === activeTestimonial
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-2 absolute inset-4"
                  }`}
                >
                  <p className="text-xs text-foreground italic leading-relaxed">&quot;{t.text}&quot;</p>
                  <p className="text-[11px] text-muted-foreground mt-2 font-medium">
                    {t.name} · {t.role}
                  </p>
                </div>
              ))}
              <div className="flex items-center gap-1 mt-3">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTestimonial(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      i === activeTestimonial ? "bg-foreground w-4" : "bg-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex flex-col gap-4 bg-background/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Secure payment</span>
              </div>
              <div className="w-px h-3 bg-border" />
              <span className="text-[10px] text-muted-foreground">Powered by Stripe</span>
            </div>
            <div className="flex items-center gap-3">
              {!promoOpen && !promoSuccess && (
                <button
                  onClick={() => setPromoOpen(true)}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors"
                >
                  Have a promo code?
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-xs rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>

          {(promoOpen || promoSuccess) && (
            <div className="flex flex-col gap-2 animate-fadeIn">
              {promoSuccess ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald/10 border border-emerald/20 text-emerald text-[11px] font-medium">
                  <Sparkles className="w-3.5 h-3.5" />
                  PRO UNLOCKED! Welcome to the elite.
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="ENTER PROMO CODE"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[11px] font-mono outline-none focus:border-emerald/50 transition-colors"
                      onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                      autoFocus
                    />
                    {promoError && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-destructive font-bold uppercase">
                        {promoError}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleApplyPromo}
                    disabled={isApplying || !promoCode}
                    className="px-4 py-2 rounded-lg bg-foreground text-background text-[11px] font-bold hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {isApplying ? <div className="w-3 h-3 border-2 border-background/20 border-t-background rounded-full animate-spin" /> : <Star className="w-3 h-3" />}
                    APPLY
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </>
  );
}
