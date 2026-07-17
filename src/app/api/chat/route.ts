import { storage } from "@/lib/storage";
import { SYSTEM_PROMPT, getEffectiveSystemPrompt } from "@/lib/ai";
import type { AIProvider, BrandKit } from "@/lib/types";
import { getCurrentUser } from "@/lib/get-user";
import { getAnonSession, saveAnonSession } from "@/lib/anon-session";
import {
  generationsLimitFor,
  getPlanEntitlements,
  normalizePlan,
  planAllowsProvider,
} from "@/lib/plans";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  sessionId: string;
  message: string;
  provider: AIProvider;
  model: string;
  apiKey?: string;
  ollamaUrl?: string;
  temperature?: number;
  customSystemPrompt?: string;
  maxTokens?: number;
  outputFormat?: "tsx" | "jsx" | "html";
  brandKit?: BrandKit;
  previewTheme?: string;
  /** Latest generated component code — enables iterative edits */
  previousCode?: string;
  /** Design style id: auto | minimal | glass | soft | … */
  designStyle?: string;
  /** Studio UI locale — drives generated copy language */
  uiLocale?: string;
}

function buildSystemPrompt(
  customSystemPrompt?: string,
  outputFormat?: string,
  brandKit?: BrandKit,
  previewTheme?: string,
  previousCode?: string,
  designStyle?: string,
  userMessage?: string,
  uiLocale?: string,
): string {
  let prompt = getEffectiveSystemPrompt(
    brandKit || {
      enabled: false,
      primaryColor: "",
      secondaryColor: "",
      accentColor: "",
      fontFamily: "",
      buttonStyle: "rounded",
      tone: "professional",
      logoUrl: "",
    },
    customSystemPrompt || "",
    previousCode,
    {
      designStyle: designStyle || "auto",
      userMessage: userMessage || "",
      uiLocale: uiLocale || "en",
    },
  );

  if (previewTheme && previewTheme !== "dark-default") {
    prompt += `\n\nTHEME INSTRUCTION (CRITICAL): The user has a LIGHT theme selected. Use white/light backgrounds (bg-white, bg-slate-50, bg-gray-50) and dark text (text-gray-900, text-slate-900). Do NOT use dark backgrounds or dark containers unless explicitly requested for contrast.`;
  }

  if (outputFormat && outputFormat !== "tsx") {
    prompt += `\n\nOUTPUT FORMAT: Provide the code in ${outputFormat} format.`;
  }

  return prompt;
}

export async function POST(req: Request) {
  const body: ChatRequest = await req.json();
  const {
    sessionId,
    message,
    provider = "groq",
    model,
    apiKey,
    ollamaUrl = "http://localhost:11434",
    temperature = 0.7,
    customSystemPrompt,
    maxTokens = 4096,
    outputFormat,
    brandKit,
    previewTheme,
    previousCode,
    designStyle,
    uiLocale,
  } = body;

  const systemPrompt = buildSystemPrompt(
    customSystemPrompt,
    outputFormat,
    brandKit,
    previewTheme,
    typeof previousCode === "string" ? previousCode : undefined,
    designStyle,
    message,
    uiLocale,
  );

  if (!sessionId || !message) {
    return new Response(JSON.stringify({ error: "sessionId and message required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limiting
  const currentUser = await getCurrentUser();
  const sseHeaders = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" };

  // Reserve generation BEFORE streaming so Set-Cookie works for anon
  // (cookies set inside a streaming response body often never stick).
  let reservedAnonGen = false;
  const anonEarly = !currentUser ? await getAnonSession() : null;
  const plan = normalizePlan(
    currentUser?.plan ?? anonEarly?.plan ?? "free"
  );
  const ent = getPlanEntitlements(plan);
  const genLimit = generationsLimitFor(plan);

  if (currentUser) {
    await storage.resetGenerationCountIfNeeded(currentUser.id);
    const refreshed = await storage.getUserById(currentUser.id);
    if (
      genLimit != null &&
      refreshed &&
      refreshed.generationCountToday >= genLimit
    ) {
      return new Response(
        `data: ${JSON.stringify({
          type: "error",
          error:
            plan === "free"
              ? `Daily limit reached (${genLimit} free gens). Upgrade to Builder (40/day), Pro (120/day), or Max (unlimited).`
              : `Daily limit reached (${genLimit} on ${ent.name}). Upgrade to a higher plan for more gens.`,
          upgrade: true,
        })}\n\n`,
        { headers: sseHeaders }
      );
    }
    if (!planAllowsProvider(plan, provider)) {
      return new Response(
        `data: ${JSON.stringify({
          type: "error",
          error: `${provider} needs Pro or Max. ${ent.name} includes: ${ent.providers.join(", ")}.`,
          upgrade: true,
        })}\n\n`,
        { headers: sseHeaders }
      );
    }
  } else {
    // Anonymous
    const anon = anonEarly!;
    if (genLimit != null && anon.generationsToday >= genLimit) {
      return new Response(
        `data: ${JSON.stringify({
          type: "error",
          error: `You've used all ${genLimit} free generations today. Upgrade to Builder (40/day) or Pro (120/day), or enter a promo code.`,
          upgrade: true,
          needsAuth: false,
        })}\n\n`,
        { headers: sseHeaders }
      );
    }
    if (!planAllowsProvider(plan, provider)) {
      return new Response(
        `data: ${JSON.stringify({
          type: "error",
          error: `${provider} requires Pro or Max. Free / Builder: Grok, Groq, Ollama, OpenAI.`,
          upgrade: true,
          needsAuth: false,
        })}\n\n`,
        { headers: sseHeaders }
      );
    }
    // Reserve only when there is a daily cap (promo Max-like = null skip)
    if (genLimit != null) {
      anon.generationsToday++;
      await saveAnonSession(anon);
      reservedAnonGen = true;
    }
  }

  // Ensure session exists (landing race: chat can fire before createSession settles)
  const existing = await storage.getSession(sessionId);
  if (!existing) {
    try {
      await storage.createSession({
        id: sessionId,
        title: "New project",
        model,
        ...(currentUser ? { userId: currentUser.id } : {}),
      });
      // Track anon browser ownership so free limits stay per-browser
      if (!currentUser) {
        const anon = await getAnonSession();
        const ids = anon.sessionIds || [];
        if (!ids.includes(sessionId)) {
          ids.push(sessionId);
          anon.sessionIds = ids;
          anon.projectCount = ids.length;
          await saveAnonSession(anon);
        }
      }
    } catch {
      /* concurrent create is fine */
    }
  }

  // Save user message
  await storage.createMessage({ id: crypto.randomUUID(), sessionId, role: "user", content: message });

  // Get conversation history
  const history = await storage.getMessages(sessionId);
  const chatMessages = history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";

      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Route to the correct provider
        if (provider === "ollama") {
          fullResponse = await streamOllama(ollamaUrl, model, chatMessages, temperature, send, systemPrompt);
        } else if (provider === "groq") {
          const key = apiKey || process.env.GROQ_API_KEY || "";
          if (!key) {
            send({ type: "error", error: "No Groq API key. Add one in Settings or set GROQ_API_KEY env var." });
            controller.close();
            return;
          }
          fullResponse = await streamOpenAICompatible(
            "https://api.groq.com/openai/v1/chat/completions",
            key, model, chatMessages, temperature, send, maxTokens, systemPrompt
          );
        } else if (provider === "xai") {
          const key = apiKey || process.env.XAI_API_KEY || "";
          if (!key) {
            send({ type: "error", error: "No xAI API key. Add one in Settings or set XAI_API_KEY env var." });
            controller.close();
            return;
          }
          const xaiModel = model || process.env.XAI_MODEL || "grok-4";
          fullResponse = await streamOpenAICompatible(
            "https://api.x.ai/v1/chat/completions",
            key, xaiModel, chatMessages, temperature, send, maxTokens, systemPrompt
          );
        } else if (provider === "deepseek") {
          const key = apiKey || process.env.DEEPSEEK_API_KEY || "";
          if (!key) {
            send({ type: "error", error: "No DeepSeek API key. Add one in Settings or set DEEPSEEK_API_KEY env var." });
            controller.close();
            return;
          }
          fullResponse = await streamOpenAICompatible(
            "https://api.deepseek.com/chat/completions",
            key, model, chatMessages, temperature, send, maxTokens, systemPrompt
          );
        } else if (provider === "openai") {
          const key = apiKey || process.env.OPENAI_API_KEY || "";
          if (!key) {
            send({ type: "error", error: "No OpenAI API key. Add one in Settings." });
            controller.close();
            return;
          }
          fullResponse = await streamOpenAICompatible(
            "https://api.openai.com/v1/chat/completions",
            key, model, chatMessages, temperature, send, maxTokens, systemPrompt
          );
        } else if (provider === "anthropic") {
          const key = apiKey || process.env.ANTHROPIC_API_KEY || "";
          if (!key) {
            send({ type: "error", error: "No Anthropic API key. Add one in Settings." });
            controller.close();
            return;
          }
          fullResponse = await streamAnthropic(key, model, chatMessages, temperature, send, maxTokens, systemPrompt);
        } else {
          send({
            type: "error",
            error: `Unknown provider "${provider}". Use groq, xai, deepseek, openai, anthropic, or ollama.`,
          });
          controller.close();
          return;
        }

        // Save assistant message
        if (fullResponse) {
          await storage.createMessage({ id: crypto.randomUUID(), sessionId, role: "assistant", content: fullResponse });
          // Signed-in: count gens when plan has a daily cap. Anon was reserved pre-stream.
          if (currentUser && genLimit != null) {
            await storage.incrementGenerationCount(currentUser.id);
          }
        } else if (reservedAnonGen) {
          // Stream produced nothing — refund reserved free gen for anon
          try {
            const anon = await getAnonSession();
            anon.generationsToday = Math.max(0, anon.generationsToday - 1);
            await saveAnonSession(anon);
          } catch {
            /* best-effort */
          }
        }

        // Auto-update title
        const session = await storage.getSession(sessionId);
        if (session && (session.title === "New chat" || session.title === "New project")) {
          const title = message.slice(0, 50) + (message.length > 50 ? "..." : "");
          await storage.updateSession(sessionId, { title });
          send({ type: "title", title });
        }

        send({ type: "done" });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Generation failed";
        console.error("Chat error:", err);
        send({ type: "error", error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

// ─── Ollama (local) ─────────────────────────────────────────

async function streamOllama(
  baseUrl: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature: number,
  send: (data: object) => void,
  sysPrompt: string = SYSTEM_PROMPT,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: sysPrompt }, ...messages],
      stream: true,
      options: { temperature },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error (${res.status}): ${text}. Make sure Ollama is running and the model is pulled.`);
  }

  let fullResponse = "";
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body from Ollama");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
        if (parsed.message?.content) {
          fullResponse += parsed.message.content;
          send({ type: "delta", text: parsed.message.content });
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  return fullResponse;
}

// ─── OpenAI-compatible (Groq, OpenAI) ───────────────────────

async function streamOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature: number,
  send: (data: object) => void,
  maxTok: number = 4096,
  sysPrompt: string = SYSTEM_PROMPT,
): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: sysPrompt }, ...messages],
      temperature,
      max_tokens: maxTok,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`API error (${res.status}): ${errBody}`);
  }

  let fullResponse = "";
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{
            delta?: {
              content?: string;
              reasoning_content?: string;
            };
          }>;
        };
        const delta = parsed.choices?.[0]?.delta;
        const content = delta?.content;
        const thought = delta?.reasoning_content;

        if (thought) {
          send({ type: "thought", text: thought });
        }
        if (content) {
          fullResponse += content;
          send({ type: "delta", text: content });
        }
      } catch {
        // skip malformed
      }
    }
  }

  return fullResponse;
}

// ─── Anthropic ──────────────────────────────────────────────

async function streamAnthropic(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature: number,
  send: (data: object) => void,
  maxTok: number = 4096,
  sysPrompt: string = SYSTEM_PROMPT,
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
      max_tokens: maxTok,
      temperature: Math.min(temperature, 1.0),
      system: sysPrompt,
      messages,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic error (${res.status}): ${errBody}`);
  }

  let fullResponse = "";
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const parsed = JSON.parse(line.slice(6)) as { type?: string; delta?: { type?: string; text?: string } };
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta" && parsed.delta.text) {
          fullResponse += parsed.delta.text;
          send({ type: "delta", text: parsed.delta.text });
        }
      } catch {
        // skip
      }
    }
  }

  return fullResponse;
}
