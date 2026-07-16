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
  const stripe = Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_PRICE_ID?.trim(),
  );

  const anyAi = Object.values(providers).some(Boolean);

  return NextResponse.json({
    ok: true,
    service: "adgenai",
    timestamp: new Date().toISOString(),
    config: {
      database: hasDb ? "postgres" : "memory",
      aiServerKeys: providers,
      aiReady: anyAi,
      githubOAuth: github,
      stripe,
    },
    hint: anyAi
      ? "Ready to generate (server keys present; BYOK also works in Settings)."
      : "Set GROQ_API_KEY or XAI_API_KEY, or add a key in Settings / use Ollama.",
  });
}
