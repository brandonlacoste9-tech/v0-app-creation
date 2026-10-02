// ─── Stream outcome (observability) ─────────────────────────────────────
// Shared contract between the chat route's provider streamers and generation
// logging. Every generation now records HOW the stream ended — completed,
// token-limited, or interrupted — instead of treating any nonempty output as
// success. This is the root-cause data that unblocks every truncation fix
// downstream (repair budgets, chain stopping, etc.).

/** Token usage reported by the provider for one generation. */
export type StreamUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

/**
 * What one provider stream produced.
 * - finishReason: the provider's terminal reason ("stop", "length", "tool_calls",
 *   Anthropic "end_turn"/"max_tokens", Ollama "stop"/"length"), or
 *   "interrupted" when the stream died with no terminal event.
 * - completed: true ONLY when a valid terminal event was observed.
 * - usage: null only when the provider sent no usage data at all.
 */
export type StreamResult = {
  text: string;
  finishReason: string | null;
  completed: boolean;
  usage: StreamUsage | null;
};

/** Finish reasons that mean the provider ran out of output budget. */
export const TRUNCATED_FINISH_REASONS = new Set(["length", "max_tokens"]);

/** Finish reasons that mean the provider finished the text cleanly. */
export const COMPLETED_FINISH_REASONS = new Set(["stop", "end_turn", "stop_sequence"]);

export type StreamOutcomeStatus = "success" | "truncated" | "interrupted" | "failed";

/** Terminal state carried through SSE and saved with the generated version. */
export type StreamCompletion = Omit<StreamResult, "text"> & {
  status: StreamOutcomeStatus;
  truncated: boolean;
};

export function toStreamCompletion(result: StreamResult | null): StreamCompletion {
  const status = classifyStreamOutcome(result);
  return {
    finishReason: result?.finishReason ?? null,
    completed: result?.completed ?? false,
    usage: result?.usage ?? null,
    status,
    truncated: status === "truncated",
  };
}

/** Accept the current wire contract and older done events without status. */
export function parseStreamCompletion(value: unknown): StreamCompletion | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as Partial<StreamCompletion>;
  const reason = typeof data.finishReason === "string"
    ? data.finishReason
    : data.truncated || data.status === "truncated"
      ? "length"
      : data.completed === false || data.status === "interrupted" || data.finishReason === null
        ? "interrupted"
        : "stop";
  const u = data.usage;
  const usage = u && [u.promptTokens, u.completionTokens, u.totalTokens]
    .every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)
    ? { promptTokens: u.promptTokens, completionTokens: u.completionTokens, totalTokens: u.totalTokens }
    : null;
  const result = toStreamResult(data.status === "failed" ? "" : "output", reason, usage);
  result.completed = result.completed && data.completed !== false;
  const completion = toStreamCompletion(result);
  if (data.status === "failed") {
    completion.status = "failed";
    completion.finishReason = data.finishReason ?? null;
  }
  return completion;
}

/**
 * Classify a finished stream for generation logging.
 * - "success": clean terminal event AND nonempty text.
 * - "truncated": provider reported token-limit exhaustion (finish_reason
 *   length / max_tokens), regardless of how much text arrived.
 * - "interrupted": stream died with no terminal event (EOF, dropped
 *   connection) or an exception was thrown mid-stream.
 * - "failed": clean completion but empty text, or no result at all.
 *
 * Incomplete output is NEVER classified "success".
 */
export function classifyStreamOutcome(
  result: StreamResult | null,
  threw: boolean = false
): StreamOutcomeStatus {
  if (!result) return "failed";
  const hasText = result.text.length > 0;
  if (result.completed && hasText) return "success";
  if (threw) return "interrupted";
  if (result.finishReason && TRUNCATED_FINISH_REASONS.has(result.finishReason)) {
    return "truncated";
  }
  if (!result.completed) return "interrupted";
  // completed but empty — nothing usable came back
  return "failed";
}

/** Build a StreamResult from parsed terminal state. Centralizes the
 * "no terminal event = interrupted" rule so every streamer agrees. */
export function toStreamResult(
  text: string,
  finishReason: string | undefined | null,
  usage: StreamUsage | null
): StreamResult {
  const reason = finishReason ?? "interrupted";
  return {
    text,
    finishReason: reason,
    completed:
      finishReason != null && COMPLETED_FINISH_REASONS.has(finishReason),
    usage,
  };
}

/** Merge provider usage fragments into a running total. */
export function addUsage(
  acc: StreamUsage | null,
  fragment: { prompt_tokens?: number | null; completion_tokens?: number | null; total_tokens?: number | null } | null | undefined
): StreamUsage | null {
  if (!fragment) return acc;
  const p = fragment.prompt_tokens ?? 0;
  const c = fragment.completion_tokens ?? 0;
  const t = fragment.total_tokens ?? p + c;
  if (!p && !c && !t) return acc;
  return {
    promptTokens: (acc?.promptTokens ?? 0) + p,
    completionTokens: (acc?.completionTokens ?? 0) + c,
    totalTokens: (acc?.totalTokens ?? 0) + t,
  };
}
