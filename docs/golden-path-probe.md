# Golden-path probe (live, on shipboard.ca)

The live end-to-end verification run as a browser task against the current
production deploy. It exercises the real flows a user hits — including paid
generations, so keep the budget tight.

## Budget
- Max **2 paid generations per probe run**, and say so in the report.
- Continue-repair sends are free (not counted against quota) — use them
  liberally to verify repair behavior.
- Never run a probe generation without the shift explicitly authorizing it.

## Preconditions
- The deploy under test is live (verified via the served-bundle `dpl` flip:
  compare the `dpl` token in `/_next/static/` asset URLs against the previous
  deploy id — never trust the Netlify build log alone).
- The browser session is signed in to an account with generation quota.

## Flow A — baseline golden path
1. Open `/studio`, start a new project from a golden-path card
   (Admin Users / Auth / Kanban) or a short store brief.
2. Hit Send; the build must complete and the preview must paint (not stay
   black). Note: build time, file count, QA score, and any console errors.

## Flow B — token-guard override send
Covers the pre-send truncation guard (`src/lib/token-guard.ts`).
1. Set the studio **Max Tokens slider to 1024** (Settings dialog).
2. Paste a big multi-file brief (12+ explicitly requested files, e.g. the
   12-file storefront brief used in `e2e/golden-path-guard.spec.ts`).
3. Hit Send — the guard dialog **must** appear with the exact copy:
   - Title: "This build will probably truncate"
   - Body naming the file count and the budget mismatch
   - Buttons: "Send anyway" and "Raise to {n}k & send"
4. Click **"Raise to 16k & send"** — this spends 1 paid generation. Verdict
   criteria: the generation completes fully (no truncation chip), i.e. the
   one-send override actually raised the budget for that send.
5. (Optional second run) With the same brief at 1k, click "Send anyway" —
   expect a truncated build with the "Needs Continue · files incomplete"
   chip, which feeds Flow C.

## Flow C — Continue-repair send
Covers the chained single-file Continue repair (`src/lib/file-checkpoint.ts`).
1. From a truncated build (Flow B step 5, or any truncated store), click
   **Continue**. The repair send must:
   - skip the token-guard dialog (repairs are single-file by design),
   - target the truncated file's missing remainder (tail-splice; no invented
     closers, no full-file rewrite),
   - ride **free** — the daily generation count must not increase.
2. If multiple files are truncated, Continue auto-chains file by file until
   none remain or a repair makes no progress. Verify the timeline shows
   per-file progress and each repaired file's code chip reports its own
   truncation state.
3. Known limitation (2026-09-25, Bee's call): at a 1k maxTokens budget the
   repair stream re-truncates and can't converge — there is no budget floor
   on repairs. Probe repairs at the studio's normal budget.

## Verdict
Report per flow: GREEN / RED with the observed evidence (dialog copy,
chip states, timeline text, QA score, preview state). Any RED becomes the
next shift's work item.
