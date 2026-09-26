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
import {
  estimateTruncationRisk,
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
 * Resolve the budget for one send. The pre-send guard's "Raise to N & send"
 * button supplies a one-send override; otherwise the studio budget applies.
 */
export function resolveEffectiveMaxTokens(
  maxTokensOverride: number | undefined,
  studioMaxTokens: number | undefined
): number {
  return maxTokensOverride ?? studioMaxTokens ?? DEFAULT_MAX_TOKENS;
}

/**
 * A Continue repair rides free (not counted against the daily generation
 * quota) only when BOTH hold:
 *  - the send was flagged as a repair continue (client sets isRepairContinue
 *    from isContinueRepairPrompt), and
 *  - the base code actually carries an incomplete-file list, so the flag
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
    readTruncatedPaths(previousCode).length > 0
  );
}
