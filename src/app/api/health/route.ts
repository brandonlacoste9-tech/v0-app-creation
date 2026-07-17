import { NextResponse } from "next/server";

/**
 * Lightweight readiness probe — no secrets leaked.
 */
export async function GET() {
  const hasDb = Boolean(process.env.DATABASE_URL?.trim());
  const providers = {
    groq: Boolean(process.env.GROQ_API_KEY?.trim()),
    xai: Boolean(process.env.XAI_API_KEY?.trim()),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  };
  const github = Boolean(
    process.env.GITHUB_CLIENT_ID?.trim() &&
      process.env.GITHUB_CLIENT_SECRET?.trim(),
  );
  const google = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
  const stripe = Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      (process.env.STRIPE_PRICE_ID?.trim() ||
        process.env.STRIPE_PRICE_ID_BUILDER?.trim() ||
        process.env.STRIPE_PRICE_ID_PRO?.trim() ||
        process.env.STRIPE_PRICE_ID_MAX?.trim()),
  );
  const appUrl = Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim());

  const anyAi = Object.values(providers).some(Boolean);

  return NextResponse.json({
    ok: true,
    service: "Shipboard",
    timestamp: new Date().toISOString(),
    config: {
      database: hasDb ? "postgres" : "memory",
      aiServerKeys: providers,
      aiReady: anyAi,
      githubOAuth: github,
      googleOAuth: google,
      appUrlConfigured: appUrl,
      stripe,
    },
    hint: anyAi
      ? github
        ? "Ready: AI + GitHub OAuth configured. Users can generate and one-click push."
        : "AI ready. Add GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET for one-click Push."
      : "Set GROQ_API_KEY or XAI_API_KEY, or add a key in Settings / use Ollama.",
    googleHint: google
      ? appUrl
        ? `Google OAuth ready. Redirect URI must be ${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")}/api/google/callback`
        : "Google keys set — also set NEXT_PUBLIC_APP_URL to your production origin."
      : "Add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET for Google sign-in.",
  });
}
