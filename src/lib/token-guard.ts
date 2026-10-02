/**
 * Pre-send token-guard decisions as pure functions.
 *
 * These are the classification seams behind the studio's golden-path sends:
 *  - the pre-send truncation guard (hold the send, offer a one-click raise),
 *  - the one-send maxTokens override ("Raise to N & send"),
 *  - the Continue-repair free-credit qualification.
 *
 * Extracted from chat-panel.tsx / api/chat/route.ts so the exact conditions
 * the UI and the server apply are covered by unit tests instead of only by
 * live browser probes. The live golden-path probe (docs/golden-path-probe.md)
 * still exercises these end to end; these tests pin the contracts in CI.
 */
import { isContinueRepairPrompt, readTruncatedPaths } from "./file-checkpoint";
import { hasIncompleteStream } from "./project-files";
import {
  estimateTruncationRisk,
  MAX_RAISE_TOKENS,
  type TruncationRisk,
} from "./truncation-risk";

/** Studio's default budget when no explicit maxTokens is configured. */
export const DEFAULT_MAX_TOKENS = 16384;

/**
 * Options carried with a send through handleSend/startGeneration.
 * The landing bootstrap remounts ChatPanel (key changes landing -> session),
 * so one-send guard decisions (raise/skip) travel to the post-bootstrap
 * auto-send via initialSendOpts instead of dying with the landing instance.
 */
export interface SendOptions {
  designStyle?: string;
  /** True when the caller already resolved the guard (e.g. a dialog button). */
  skipTokenGuard?: boolean;
  /** One-send budget override from the guard's "Raise to N & send". */
  maxTokensOverride?: number;
}

/**
 * Returns the TruncationRisk when the pre-send guard must hold this send,
 * null when the send may proceed directly.
 *
 * The guard never eats a Continue-repair send: repairs are single-file by
 * design and always skip the guard.
 */
export function shouldShowTokenGuard(
  msg: string,
  maxTokens: number | undefined,
  opts?: SendOptions
): TruncationRisk | null {
  if (opts?.skipTokenGuard) return null;
  if (isContinueRepairPrompt(msg)) return null;
  const risk = estimateTruncationRisk(msg, maxTokens ?? DEFAULT_MAX_TOKENS);
  return risk.risk === "high" ? risk : null;
}

/**
 * Context for resolving a Continue repair's budget. The studio chat panel
 * maintains this per session: the effective budget of the (truncated)
 * generation being continued, plus how many consecutive repair attempts on
 * the current chain ended in provider-reported exhaustion.
 */
export interface RepairBudgetContext {
  /** Effective budget of the original generation the repair continues. */
  baseBudget?: number;
  /** Consecutive repair attempts that hit provider-reported exhaustion. */
  exhaustionRaises?: number;
}

/**
 * Resolve the budget for one send. The pre-send guard's "Raise to N & send"
 * button supplies a one-send override; otherwise the studio budget applies.
 *
 * Repairs never send below the normal build budget (DEFAULT_MAX_TOKENS),
 * independently of the slider — and they inherit the effective budget of the
 * generation they continue, so a one-send guard raise on the original build
 * is not lost when the user hits Continue. Each consecutive repair attempt
 * that ended in provider-reported exhaustion (finish_reason length /
 * max_tokens) doubles the budget, capped at MAX_RAISE_TOKENS, so a repair
 * chain converges instead of re-truncating at the same budget.
 */
export function resolveEffectiveMaxTokens(
  maxTokensOverride: number | undefined,
  studioMaxTokens: number | undefined,
  isRepairContinue = false,
  repairContext?: RepairBudgetContext
): number {
  const requested = maxTokensOverride ?? studioMaxTokens ?? DEFAULT_MAX_TOKENS;
  const budget = Number.isFinite(requested) && requested > 0
    ? Math.floor(requested)
    : DEFAULT_MAX_TOKENS;
  if (!isRepairContinue) return budget;
  const base = repairContext?.baseBudget;
  const baseBudget =
    typeof base === "number" && Number.isFinite(base) && base > 0
      ? Math.floor(base)
      : budget;
  // The repair keeps the richest of: the original generation's effective
  // budget, the current studio budget, and the model-supported minimum —
  // never above the platform's raise ceiling.
  let repairBudget = Math.min(
    Math.max(baseBudget, budget, DEFAULT_MAX_TOKENS),
    MAX_RAISE_TOKENS
  );
  const raises = Math.min(
    Math.max(0, Math.floor(repairContext?.exhaustionRaises ?? 0)),
    10
  );
  for (let i = 0; i < raises; i++) {
    if (repairBudget >= MAX_RAISE_TOKENS) break;
    repairBudget = Math.min(repairBudget * 2, MAX_RAISE_TOKENS);
  }
  return repairBudget;
}

/**
 * True when a repair attempt's stream completion reports provider-side token
 * exhaustion (finish_reason length / max_tokens, surfaced as
 * completion.truncated). Only provider-reported exhaustion raises the next
 * repair's budget — an interrupted stream (dropped connection, user abort) or
 * a provider error says nothing about the budget, so it breaks the raise
 * streak instead of extending it.
 */
export function repairHitExhaustion(
  completion: { truncated?: boolean } | undefined | null
): boolean {
  return completion?.truncated === true;
}

/**
 * A Continue repair rides free (not counted against the daily generation
 * quota) only when BOTH hold:
 *  - the send was flagged as a repair continue (client sets isRepairContinue
 *    from isContinueRepairPrompt), and
 *  - the base code carries incomplete files or an incomplete stream, so the flag
 *    alone can never buy free generations.
 *
 * Used by the chat API route; the unit tests assert client and server agree.
 */
export function qualifiesForFreeRepair(
  isRepairContinue: boolean | undefined,
  previousCode: unknown
): boolean {
  return (
    isRepairContinue === true &&
    typeof previousCode === "string" &&
    (readTruncatedPaths(previousCode).length > 0 || hasIncompleteStream(previousCode))
  );
}
