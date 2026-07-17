# Preview defense fixtures

Regression wall for the hybrid single-pass principle:

> **Don’t make the model write “preview dialect.” Make the preview path absorb production dialect.**

Shipboard processes raw LLM output. These fixtures defend the preview compiler against:

| Threat | How fixtures help |
|--------|-------------------|
| **Syntax drift** | `React.FC`, nested interfaces, hook generics, `satisfies` — shapes models invent month to month |
| **Incomplete streams** | Mid-className / mid-string / mid-tag cuts without crashing the iframe thread |
| **Model swaps** | Re-run the suite after an OpenRouter model change; failures show strip/mount breaks immediately |

## Run

```bash
npm run test:preview
# or
npx tsx src/lib/preview-fixtures.test.ts
npx tsx scripts/debug-preview.ts   # interactive Babel probe
```

## Add a fixture

1. Open `catalog.ts`.
2. Append a `PreviewFixture` with a stable `id`, `category`, and `why`.
3. For complete shapes: set `mustStrip` / `mustKeep` for the failures you care about.
4. For mid-stream cuts: set `truncated: true` (suite only requires heal + wrap survival).
5. Run `npm run test:preview`.

Prefer **real failed red-panel paste** over synthetic minimal cases when filing a new shape.

## When to graduate off regex

Hold SWC WASM / full in-browser TS preset until this suite shows recurring residual patterns that regex cannot fix without eating JSX. Bundle cost is only worth it when fixture pain is chronic.
