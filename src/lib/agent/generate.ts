/**
 * Agent API generation: non-streaming store generation from a brief.
 * Used by POST /api/agent/stores — one call builds a whole store.
 */
import { getEffectiveSystemPrompt } from "@/lib/ai";
import {
  buildStoreBrief,
  buildStoreUserPrompt,
  type StoreBrief,
} from "@/lib/commerce/store-brief";
import { validateGeneration } from "@/lib/gen-integrity";
import { serializeProject } from "@/lib/project-files";
import {
  toStreamCompletion,
  toStreamResult,
  type StreamCompletion,
  type StreamUsage,
} from "@/lib/stream-outcome";
import { MAX_RAISE_TOKENS } from "@/lib/truncation-risk";

export interface AgentGenerateOptions {
  brief: StoreBrief;
  /** AI provider: groq | xai | deepseek | openai | anthropic */
  provider?: string;
  model?: string;
  /** Optional override API key; falls back to env vars */
  apiKey?: string;
  /** Previous code for iterative updates */
  previousCode?: string | null;
  /** Custom user message for updates (instead of the brief prompt) */
  message?: string;
  /**
   * Output token budget override (default 8192). Clamped to
   * [1024, MAX_RAISE_TOKENS] so the agent lane can't drift above the
   * studio's top raise tier or below a useful floor.
   */
  maxTokens?: number;
}

export interface AgentGenerateResult {
  ok: boolean;
  /** Full AI response text */
  text: string;
  /** Serialized project code (multi-file JSON or single-file TSX) */
  code: string | null;
  /** Integrity report from validateGeneration */
  integrity: ReturnType<typeof validateGeneration>;
  /**
   * Provider terminal outcome — mirrors the studio's `done` event
   * (`finishReason`, `usage`, `status`, `truncated`). Retained on every
   * path, including failures, so callers never see "success" without
   * knowing how the call actually ended.
   */
  completion: StreamCompletion;
  error?: string;
}

const PROVIDER_ENDPOINTS: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  xai: "https://api.x.ai/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
};

const PROVIDER_ENV_KEYS: Record<string, string> = {
  groq: "GROQ_API_KEY",
  xai: "XAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  groq: "llama-3.3-70b-versatile",
  xai: "grok-4",
  deepseek: "deepseek-chat",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
};

/** Default output budget for the agent lane (unchanged from before). */
const DEFAULT_AGENT_MAX_TOKENS = 8192;
/** Floor keeps a caller from starving the model into guaranteed truncation. */
const MIN_AGENT_MAX_TOKENS = 1024;

/** What one non-streaming provider call produced. */
interface NonStreamingResult {
  text: string;
  finishReason: string | null;
  usage: StreamUsage | null;
}

/** Clamp a caller-supplied budget to [1024, MAX_RAISE_TOKENS]. */
export function resolveAgentMaxTokens(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_AGENT_MAX_TOKENS;
  }
  return Math.min(
    MAX_RAISE_TOKENS,
    Math.max(MIN_AGENT_MAX_TOKENS, Math.floor(raw)),
  );
}

/**
 * Non-streaming OpenAI-compatible chat completion.
 * Returns the full assistant text PLUS the provider's stop metadata —
 * the studio lane does this too, and the agent lane was silently
 * dropping finish_reason/usage, so truncation read as success.
 */
async function nonStreamingChat(
  endpoint: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = DEFAULT_AGENT_MAX_TOKENS,
): Promise<NonStreamingResult> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI provider error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  const finishReason =
    typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
  const usage = parseOpenAIUsage(data?.usage);
  if (typeof content !== "string" || !content.trim()) {
    // Return the stop metadata even for empty replies so the caller can
    // tell "model said nothing" apart from "budget cut it off".
    return { text: "", finishReason, usage };
  }
  return { text: content, finishReason, usage };
}

/** Extract a normalized usage object from an OpenAI-compatible payload. */
function parseOpenAIUsage(u: unknown): StreamUsage | null {
  if (!u || typeof u !== "object") return null;
  const d = u as Record<string, unknown>;
  const p = numOrNull(d.prompt_tokens);
  const c = numOrNull(d.completion_tokens);
  const t = numOrNull(d.total_tokens);
  if (p === null || c === null) return null;
  return { promptTokens: p, completionTokens: c, totalTokens: t ?? p + c };
}

/** Extract a normalized usage object from an Anthropic payload. */
function parseAnthropicUsage(u: unknown): StreamUsage | null {
  if (!u || typeof u !== "object") return null;
  const d = u as Record<string, unknown>;
  const p = numOrNull(d.input_tokens);
  const c = numOrNull(d.output_tokens);
  if (p === null || c === null) return null;
  return { promptTokens: p, completionTokens: c, totalTokens: p + c };
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

/** Non-streaming Anthropic chat completion. Returns text + stop metadata. */
async function nonStreamingAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = DEFAULT_AGENT_MAX_TOKENS,
): Promise<NonStreamingResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const blocks = data?.content;
  const stopReason =
    typeof data?.stop_reason === "string" ? data.stop_reason : null;
  const usage = parseAnthropicUsage(data?.usage);
  if (Array.isArray(blocks)) {
    const text = blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (text.trim()) return { text, finishReason: stopReason, usage };
  }
  return { text: "", finishReason: stopReason, usage };
}

/**
 * Generate a store from a brief. Non-streaming — waits for the full response,
 * then runs the same validateGeneration + repair pipeline the studio uses.
 */
export async function generateStoreFromBrief(
  opts: AgentGenerateOptions,
): Promise<AgentGenerateResult> {
  const provider = (opts.provider || "xai").toLowerCase();
  const model =
    opts.model || PROVIDER_DEFAULT_MODELS[provider] || "grok-4";

  const envKey = PROVIDER_ENV_KEYS[provider];
  const apiKey = opts.apiKey || (envKey ? process.env[envKey] : "") || "";
  const maxTokens = resolveAgentMaxTokens(opts.maxTokens);
  if (!apiKey) {
    return {
      ok: false,
      text: "",
      code: null,
      integrity: validateGeneration("", null),
      completion: toStreamCompletion(null),
      error: `No API key for provider "${provider}". Pass apiKey or set ${envKey}.`,
    };
  }

  const systemPrompt = getEffectiveSystemPrompt(
    {
      enabled: false,
      primaryColor: "",
      secondaryColor: "",
      accentColor: "",
      fontFamily: "",
      buttonStyle: "rounded",
      tone: "professional",
      logoUrl: "",
    },
    "",
    opts.previousCode || undefined,
    {
      designStyle: opts.brief.designStyle || "auto",
      userMessage: opts.message || "",
      uiLocale: "en",
      byobSchema: null,
      storeBrief: opts.brief,
    },
  );

  const userPrompt = opts.message || buildStoreUserPrompt(opts.brief);

  let gen: NonStreamingResult;
  try {
    if (provider === "anthropic") {
      gen = await nonStreamingAnthropic(
        apiKey,
        model,
        systemPrompt,
        userPrompt,
        maxTokens,
      );
    } else {
      const endpoint = PROVIDER_ENDPOINTS[provider];
      if (!endpoint) {
        return {
          ok: false,
          text: "",
          code: null,
          integrity: validateGeneration("", null),
          completion: toStreamCompletion(null),
          error: `Unknown provider "${provider}". Use groq, xai, deepseek, openai, or anthropic.`,
        };
      }
      gen = await nonStreamingChat(
        endpoint,
        apiKey,
        model,
        systemPrompt,
        userPrompt,
        maxTokens,
      );
    }
  } catch (err) {
    return {
      ok: false,
      text: "",
      code: null,
      integrity: validateGeneration("", null),
      completion: toStreamCompletion(null),
      error: err instanceof Error ? err.message : "Generation failed",
    };
  }

  // Same terminal-outcome contract as the studio lane: stop metadata is
  // classified, never dropped — a "length"/"max_tokens" finish is
  // truncated, not success.
  const completion = toStreamCompletion(
    toStreamResult(gen.text, gen.finishReason, gen.usage),
  );
  const text = gen.text;
  if (!text.trim()) {
    return {
      ok: false,
      text,
      code: null,
      integrity: validateGeneration("", null),
      completion,
      error: completion.truncated
        ? `Model stopped on the output token budget (finish_reason ${completion.finishReason}). Retry with a larger maxTokens.`
        : "AI provider returned empty response",
    };
  }

  // Same pipeline as the studio: extract → repair → validate.
  // Serialize WITH the truncated-file list and the completion record, the
  // way the studio does — the old code dropped both, so the saved version
  // lost the incomplete-file metadata and Continue had nothing to target.
  const integrity = validateGeneration(text, opts.previousCode || null);
  const proj = integrity.project;
  const projEntry = proj.files[proj.entry];
  let code: string | null = null;
  if (projEntry?.trim()) {
    code =
      integrity.isMulti || Object.keys(proj.files).length > 1
        ? serializeProject(proj.files, proj.entry, proj.truncated, completion)
        : projEntry.trim();
  }

  // Explicitly incomplete when validation fails — never ok: true. The old
  // hardFail only caught a few error codes, so a truncated_code error (or a
  // provider-level budget cutoff that still produced parseable code) came
  // back "ok". Provider truncation is a hard fail on its own: the text is
  // cut mid-file, so whatever validated is not the whole build.
  const firstError = integrity.issues.find((i) => i.severity === "error");
  const hardFail = !code || !integrity.ok || completion.truncated;

  return {
    ok: !hardFail,
    text,
    code,
    integrity,
    completion,
    error: hardFail
      ? completion.truncated
        ? `Model stopped on the output token budget (finish_reason ${completion.finishReason}). Retry with a larger maxTokens.`
        : !code
          ? "Model returned no usable code"
          : (firstError?.message ?? "Generation failed integrity checks")
      : undefined,
  };
}
