"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, LogIn } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import {
  clearCheckoutPlan,
  openOAuthPopup,
  peekCheckoutPlan,
  rememberCheckoutPlan,
  startStripeCheckoutSession,
} from "@/lib/checkout-client";
import { marketingTiers, type MarketingTier } from "@/lib/plans";
import { isPaidPlanId, type PaidPlanId } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { GithubIcon } from "@/components/icons";

function ctaLabel(tier: MarketingTier) {
  if (!tier.checkout) return "Start free";
  return `Checkout ${tier.name}`;
}

export function PricingGrid({
  className,
  id,
}: {
  className?: string;
  id?: string;
}) {
  const tiers = marketingTiers();
  const [busy, setBusy] = useState<PaidPlanId | null>(null);
  const [pendingPlan, setPendingPlan] = useState<PaidPlanId | null>(null);
  const [error, setError] = useState("");
  const [googleOn, setGoogleOn] = useState(false);

  const runCheckout = useCallback(async (plan: PaidPlanId) => {
    setError("");
    setBusy(plan);
    rememberCheckoutPlan(plan);
    try {
      const { url } = await startStripeCheckoutSession(plan, "/pricing");
      clearCheckoutPlan();
      window.location.href = url;
    } catch (err) {
      if (err instanceof ApiError && (err.needsAuth || err.status === 401)) {
        setPendingPlan(plan);
        setError("Sign in to continue to Stripe checkout.");
        return;
      }
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d: { authProviders?: { google?: boolean } }) =>
        setGoogleOn(Boolean(d.authProviders?.google))
      )
      .catch(() => setGoogleOn(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("checkout");
    const signedIn = params.get("signed_in") === "1";
    if (isPaidPlanId(fromQuery) || signedIn) {
      window.history.replaceState({}, "", window.location.pathname);
      const plan = isPaidPlanId(fromQuery) ? fromQuery : peekCheckoutPlan();
      if (plan) void runCheckout(plan);
    }
  }, [runCheckout]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const github = event.data === "github-connected";
      const google =
        event.data === "google-connected" ||
        (event.data &&
          typeof event.data === "object" &&
          (event.data as { type?: string }).type === "shipboard-auth");
      if (!github && !google) return;
      const plan = pendingPlan || peekCheckoutPlan();
      if (plan) void runCheckout(plan);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [pendingPlan, runCheckout]);

  const signIn = async (provider: "github" | "google") => {
    const plan = pendingPlan || peekCheckoutPlan();
    if (plan) rememberCheckoutPlan(plan);
    setError("");
    try {
      await openOAuthPopup(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    }
  };

  return (
    <div id={id} className={className}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-card p-6",
              tier.popular
                ? "border-orange-500/50 shadow-[0_0_40px_-18px_rgba(249,115,22,0.45)]"
                : "border-border"
            )}
          >
            {tier.popular ? (
              <p className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                Popular
              </p>
            ) : null}
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
              {tier.name}
            </p>
            <p className="mt-2 text-3xl font-bold">
              ${tier.priceCad}
              <span className="text-sm font-normal text-muted-foreground">
                /mo CAD
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{tier.blurb}</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
              {tier.features.map((p) => (
                <li key={p} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {p}
                </li>
              ))}
            </ul>
            {tier.checkout ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => runCheckout(tier.id as PaidPlanId)}
                className={cn(
                  "mt-6 block w-full rounded-xl py-2.5 text-center text-sm font-semibold",
                  tier.popular
                    ? "bg-orange-500 text-white hover:bg-orange-400"
                    : "border border-border hover:border-orange-500/40"
                )}
              >
                {busy === tier.id ? "Opening Stripe…" : ctaLabel(tier)}
              </button>
            ) : (
              <Link
                href="/studio"
                className="mt-6 block rounded-xl border border-border py-2.5 text-center text-sm font-semibold hover:border-orange-500/40"
              >
                {ctaLabel(tier)}
              </Link>
            )}
          </div>
        ))}
      </div>

      {pendingPlan ? (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="text-foreground">
            Sign in so Stripe can attach{" "}
            <span className="font-semibold capitalize">{pendingPlan}</span> to
            your Shipboard account.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void signIn("github")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
            >
              <GithubIcon className="h-3.5 w-3.5" />
              Sign in with GitHub
            </button>
            {googleOn ? (
              <button
                type="button"
                onClick={() => void signIn("google")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign in with Google
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 text-center text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
