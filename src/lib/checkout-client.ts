"use client";

import { ApiError, startGitHubAuth, startGoogleAuth } from "@/lib/api-client";
import { isPaidPlanId, type PaidPlanId } from "@/lib/pricing";

export const CHECKOUT_COOKIE = "sb_checkout_plan";
export const CHECKOUT_STORAGE_KEY = "shipboard_checkout_plan";

export function rememberCheckoutPlan(plan: PaidPlanId) {
  try {
    sessionStorage.setItem(CHECKOUT_STORAGE_KEY, plan);
    document.cookie = `${CHECKOUT_COOKIE}=${plan}; Path=/; Max-Age=600; SameSite=Lax`;
  } catch {
    /* private mode */
  }
}

export function peekCheckoutPlan(): PaidPlanId | null {
  try {
    const fromStore = sessionStorage.getItem(CHECKOUT_STORAGE_KEY);
    if (isPaidPlanId(fromStore)) return fromStore;
    const match = document.cookie.match(
      /(?:^|; )sb_checkout_plan=(builder|pro|max)/
    );
    if (match && isPaidPlanId(match[1])) return match[1];
  } catch {
    /* ignore */
  }
  return null;
}

export function clearCheckoutPlan() {
  try {
    sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
    document.cookie = `${CHECKOUT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export async function startStripeCheckoutSession(
  plan: PaidPlanId,
  cancelPath = "/pricing"
): Promise<{ url: string }> {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, cancelPath }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
    needsAuth?: boolean;
  };
  if (res.status === 401 || data.needsAuth) {
    throw new ApiError(data.error || "Sign in to upgrade", {
      status: 401,
      needsAuth: true,
    });
  }
  if (!res.ok || !data.url) {
    throw new ApiError(data.error || "Checkout failed", { status: res.status });
  }
  return { url: data.url };
}

export async function openOAuthPopup(
  provider: "github" | "google"
): Promise<boolean> {
  const data =
    provider === "github" ? await startGitHubAuth() : await startGoogleAuth();
  if (!data.url) {
    throw new ApiError(data.error || `${provider} sign-in is not configured`, {
      status: 503,
    });
  }
  const name = provider === "github" ? "github-auth" : "google-auth";
  const popup = window.open(data.url, name, "width=600,height=700,popup=yes");
  if (!popup) {
    window.location.href = data.url;
    return false;
  }
  return true;
}
