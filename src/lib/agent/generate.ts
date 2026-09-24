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
}

export interface AgentGenerateResult {
  ok: boolean;
  /** Full AI response text */
  text: string;
  /** Serialized project code (multi-file JSON or single-file TSX) */
  code: string | null;
  /** Integrity report from validateGeneration */
  integrity: ReturnType<typeof validateGeneration>;
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

/**
 * Non-streaming OpenAI-compatible chat completion.
 * Returns the full assistant text.
 */
async function nonStreamingChat(
  endpoint: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 8192,
): Promise<string> {
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
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI provider returned empty response");
  }
  return content;
}

/** Non-streaming Anthropic chat completion. */
async function nonStreamingAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 8192,
): Promise<string> {
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
  if (Array.isArray(blocks)) {
    const text = blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (text.trim()) return text;
  }
  throw new Error("Anthropic returned empty response");
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
  if (!apiKey) {
    return {
      ok: false,
      text: "",
      code: null,
      integrity: validateGeneration("", null),
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

  let text: string;
  try {
    if (provider === "anthropic") {
      text = await nonStreamingAnthropic(
        apiKey,
        model,
        systemPrompt,
        userPrompt,
      );
    } else {
      const endpoint = PROVIDER_ENDPOINTS[provider];
      if (!endpoint) {
        return {
          ok: false,
          text: "",
          code: null,
          integrity: validateGeneration("", null),
          error: `Unknown provider "${provider}". Use groq, xai, deepseek, openai, or anthropic.`,
        };
      }
      text = await nonStreamingChat(
        endpoint,
        apiKey,
        model,
        systemPrompt,
        userPrompt,
      );
    }
  } catch (err) {
    return {
      ok: false,
      text: "",
      code: null,
      integrity: validateGeneration("", null),
      error: err instanceof Error ? err.message : "Generation failed",
    };
  }

  // Same pipeline as the studio: extract → repair → validate
  const integrity = validateGeneration(text, opts.previousCode || null);
  const proj = integrity.project;
  const projEntry = proj.files[proj.entry];
  let code: string | null = null;
  if (projEntry?.trim()) {
    code =
      integrity.isMulti || Object.keys(proj.files).length > 1
        ? serializeProject(proj.files, proj.entry)
        : projEntry.trim();
  }

  const hardFail =
    !code ||
    (!integrity.ok &&
      integrity.issues.some(
        (i) =>
          i.severity === "error" &&
          (i.code === "no_code" ||
            i.code.startsWith("placeholder_previous") ||
            i.code === "placeholder_rest"),
      ));

  return {
    ok: !hardFail,
    text,
    code,
    integrity,
    error: hardFail ? "Model returned no usable code" : undefined,
  };
}
