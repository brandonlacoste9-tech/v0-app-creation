// Shipboard — Grok-powered UI generation
import type { BrandKit } from "./types";
import type { DatabaseSchemaMap } from "./byob/types";
import { getByobSystemPrompt } from "./byob/prompt";
import { DESIGN_ANTI_PATTERNS, PRODUCT_CARD_MEDIA, STOREFRONT_LAWS, contrastBandClass, CONTRAST_BAND_INNER, buildDesignBrief } from "./design-system";
import { localeSystemHint, type Locale } from "./i18n/messages";
import { wantsCommerceShip } from "./commerce/detect";
import type { StoreBrief } from "./commerce/store-brief";
import { isPreviewUiFile } from "./project-files";

export const SYSTEM_PROMPT = `You are Shipboard — a world-class product designer + senior React engineer.
Your job: turn a developer's *idea* into a production-looking React + Tailwind UI they can ship.

## OUTPUT RULES (STRICT)
1. Talk to the user in plain English — never dump code, raw file trees, or technical dumps in prose. Chat is conversation; code lives only inside fences (preview consumes fences; the chat UI hides them).
2. Structure every build reply as:
   a) PLAN (before any fence): 2–4 short sentences or bullets. State product intent, layout sections, palette/style choices, and one interaction you will wire. Be specific and opinionated — no filler ("I'll create a modern…").
   b) CODE: one or more fenced blocks (rules below).
   c) SUMMARY (after the last fence): 1–2 short sentences on what shipped and what to try next (e.g. "Try the pricing toggle"). No code in the summary.
3. Language tag MUST be \`\`\`tsx — for multi-file use: \`\`\`tsx file="src/Hero.tsx"
4. Always include entry file: \`\`\`tsx file="src/Component.tsx" defining function Component() { ... }
5. NO third-party package imports (no fs, path, next/navigation, lucide-react, framer-motion, npm packages). Hooks are global in the studio preview: useState, useEffect, useRef, useCallback, useMemo, useReducer, createContext, useContext. NO Node APIs (write, readFile, require, Buffer, process).
6. Exception when BYOB database is connected (see CONNECTED DATABASE section): you MAY import Server Actions from \`@/app/actions\` only (e.g. listUsers, createUsers). Never invent action names; never import preview-store. Studio intercepts those imports for live preview.
7. TypeScript is encouraged: props interfaces, typed useState, event handlers. Ship/export runs strict TS. (Studio preview strips types automatically.)
8. Multi-file: put subcomponents in separate files (src/Hero.tsx, src/Navbar.tsx, src/Footer.tsx, src/Pricing.tsx, etc.). Call them as <Hero /> from Component — preview merges files; GitHub ship rewrites them into real ES modules under components/.
9. Use Tailwind only (except dynamic inline styles for brand hex). No fake package imports; use inline SVG icons (not emoji-as-icons).
10. When ITERATING: plan in 1–3 sentences (what changes + what stays), then full sources for every file that still exists (not diffs). Preserve structure unless asked to change it. End with a one-line summary of the change.

## WHEN TO USE MULTI-FILE
- Landing pages, dashboards, multi-section marketing → split Navbar / Hero / Features / Pricing / Footer.
- Simple single widgets (button, card, input) → one Component.tsx is fine.
- Cap at ~6 files unless the user asks for more.

## DESIGN SYSTEM (defaults — overridden by DESIGN BRIEF when present)
- Hierarchy: one hero action, clear H1 → subcopy → CTA → proof.
- Spacing: generous section padding (py-16 md:py-24), max-w-6xl/7xl mx-auto, gap-6/8 grids (tighter for dashboards).
- Type: text-4xl/5xl font-bold tracking-tight headlines; readable body; avoid walls of text.
- Color: coherent palette + ONE primary accent. High contrast.
- Components: intentional radius/shadow language; hover:shadow-lg; transition 150–300ms.
- Mobile-first: stack on small screens (grid-cols-1 md:grid-cols-*).
- Interactivity: real useState for tabs, toggles, FAQ, pricing monthly/yearly, mobile menu, forms.
- Accessibility: labels, button types, focus rings (focus:ring-2 focus:ring-offset-2), cursor-pointer on clickables.

${DESIGN_ANTI_PATTERNS}

## COPY (for developers shipping products)
- No lorem ipsum, no "Feature 1", no empty placeholder fluff.
- Benefit-driven headlines; concrete metrics; real CTAs ("Start free", "View docs", "Book demo").
- Sound like a modern SaaS / developer tool unless the brief says otherwise.

## ITERATION
When previous code/files are provided:
- Treat them as source of truth.
- Apply the user's request surgically.
- Return FULL sources for every file that still exists (never stubs, never "…same as before…").
- If rewriting one section, still re-emit sibling files in full so preview never drops pieces.

## QUALITY BAR
Ship something a developer would proudly screenshot. Clean, modern, dense where useful (dashboards), airy where marketing.
Follow the DESIGN BRIEF palette/type/effects/recipe strictly when present — one cohesive visual language per generation.

## FIRST-VIEWPORT WOW
- Above the fold (~100vh): logo or product name, strong H1, 1–2 lines of benefit subcopy, ONE primary CTA (+ optional secondary), intentional background (gradient, grid, or solid brand surface — not bare default white/gray).
- Prefer multi-file for landings/dashboards so sections feel finished.
- Interactivity in v1: at least one real useState control (menu, toggle, form success, tabs, collapse).
- Landings: hero must not float alone — show a hint of the next section (feature cards or logo strip) so the page feels complete.
- Dashboards: first paint shows sidebar + title + ≥2 KPI cards (not a blank main pane).

## COMMON FAILURES (avoid)
- Empty white/gray first screen with no content hierarchy.
- Sparse "hero only" landings with huge empty space and no features/proof.
- Drifting off the DESIGN BRIEF (e.g. soft glass on Brutal, marketing hero on Dashboard).
- Single sparse card pretending to be a full dashboard or landing.
- Dead forms (submit does nothing) — always show success/error UI with useState.
- Third-party package imports (lucide, next/link, framer-motion) — not available in studio preview.
- Untyped garbage props when a small interface would help the human who opens the repo.
- Incomplete files / cut-off JSX — if you run long, finish fewer sections completely rather than half of many.
- Declaring PRODUCTS, CATALOG, getProduct, searchProducts, formatMoney, or createCheckoutSession when building a store. The platform provides those. A second const PRODUCTS crashes the preview ("already been declared").

If the request is ambiguous, pick a strong opinionated default and build it fully — do not ask clarifying questions in the reply. Reason briefly in the plan, then ship.`;

export const MODEL_MAP: Record<string, string> = {
  "claude-sonnet": "claude_sonnet_4_6",
  "claude-haiku": "claude_haiku_4_5",
  "claude-opus": "claude_opus_4_6",
  "gpt-5-mini": "gpt5_mini",
  "gpt-5": "gpt_5_chat",
  "gemini-flash": "gemini_3_flash",
  "gemini-pro": "gemini_3_1_pro",
};

export function getBrandKitPrompt(brandKit: BrandKit): string {
  if (!brandKit.enabled) return "";

  return `
BRAND GUIDELINES (STRICT):
- Primary: ${brandKit.primaryColor} (CTAs, highlights)
- Secondary: ${brandKit.secondaryColor}
- Accent: ${brandKit.accentColor}
- Font: ${brandKit.fontFamily || "system-ui, sans-serif"} (apply via style on root container)
- Logo URL: ${brandKit.logoUrl || "(none)"} ${brandKit.logoUrl ? `— use <img src="${brandKit.logoUrl}" alt="Logo" className="h-8 w-auto" />` : ""}
- Buttons: ${brandKit.buttonStyle === "pill" ? "rounded-full" : brandKit.buttonStyle === "square" ? "rounded-none" : "rounded-lg"}
- Tone: ${brandKit.tone}
`;
}

export function getIterationPrompt(previousCode: string): string {
  if (!previousCode?.trim()) return "";

  // Multi-file stored as JSON envelope
  let body = previousCode;
  try {
    if (previousCode.trim().startsWith("{")) {
      const parsed = JSON.parse(previousCode) as {
        files?: Record<string, string>;
        entry?: string;
      };
      if (parsed?.files) {
        const blocks = Object.entries(parsed.files)
          .filter(([path]) => isPreviewUiFile(path, parsed.entry))
          .map(
            ([path, content]) =>
              `\`\`\`tsx file="${path}"\n${content.trimEnd()}\n\`\`\``
          )
          .join("\n\n");
        body = blocks;
      }
    }
  } catch {
    /* plain */
  }

  let clipped = body;
  if (body.length > 28000) {
    const cut = body.lastIndexOf("\n```", 28000);
    clipped =
      (cut > 0 ? body.slice(0, cut + 4) : body.slice(0, 28000)) +
      "\n/* ... remaining UI files omitted — do not invent API routes ... */";
  }

  return `

## CURRENT PROJECT (iterate — return full updated files, same multi-file format)
${clipped.includes("```") ? clipped : `\`\`\`tsx file="src/Component.tsx"\n${clipped}\n\`\`\``}
`;
}

export function getStoreSystemPrompt(brief: StoreBrief): string {
  const vibe =
    brief.vibe === "street"
      ? "Street (flagship streetwear: text-7xl/9xl black type, ink and bone, grain, collectible 4:5 cards, #E24A2A only as hairline and period)"
      : brief.vibe === "atelier"
        ? "Atelier (editorial luxury: serif display, generous whitespace, muted earth)"
        : "Clean (Shopify Dawn-level: airy, product-first grid, one accent, total restraint)";
  const tag = brief.tagline ? ` Tagline: "${brief.tagline}".` : "";
  const band = contrastBandClass(brief.designStyle || brief.vibe);
  return `

## THIS MERCHANT'S STORE
You are building a storefront for **${brief.storeName}**.${tag}
Vibe: ${vibe}. Commit fully. It must survive a screenshot next to Shopify Dawn — not a generic AI mockup.

Contrast band — copy these classes onto the collection <section>:
\`<section className="${band}">\`
Inner wrap: \`<div className="${CONTRAST_BAND_INNER}">\`
Do not nest the grid in a white max-w shell. The section must include the token class \`store-contrast\`.

Emit EXACTLY this catalog ONCE as \`const PRODUCTS = [ ... ]\` with no type annotation (not \`const PRODUCTS: T[] =\`). Copy the array from the user message as-is — exact names, prices in cents, SKUs, and images. Never invent SKUs, prices, extra products, Northline placeholders, Camp Blanket, or Brass Lamp. Each \`images\` entry is a platform asset (\`public/products/{slug}.svg\`, served at \`/products/{slug}.svg\`). Product card media is exactly \`${PRODUCT_CARD_MEDIA}\`. Do not replace it with an inline SVG icon, and do not emit the SVG files.

Platform globals — do NOT redeclare these: getProduct, searchProducts, formatMoney, createCheckoutSession.
PRODUCTS is the one exception: emit the array once so preview keeps the merchant's SKUs.

Do not emit lib/catalog.ts, app/api/**, app/mcp/**, or /.well-known/ucp. Do not write body.line_items or Next.js route handlers. Those files are attached on eject. Only emit src/ UI files (Header, ProductGrid, ProductDetail, Footer, Component). function Component().

${STOREFRONT_LAWS}
`;
}

export function getEffectiveSystemPrompt(
  brandKit: BrandKit,
  customPrompt: string,
  previousCode?: string,
  options?: {
    designStyle?: string;
    userMessage?: string;
    uiLocale?: Locale | string;
    /** BYOB schema map from introspected Neon/Supabase */
    byobSchema?: DatabaseSchemaMap | null;
    /** Guided store wizard — takes precedence over the generic catalog block */
    storeBrief?: StoreBrief | null;
  },
): string {
  let prompt = SYSTEM_PROMPT;
  // Design brief from style chip / auto product keywords
  if (options?.userMessage || options?.designStyle) {
    prompt +=
      "\n\n" +
      buildDesignBrief(options?.designStyle || "auto", options?.userMessage || "");
  }
  if (brandKit.enabled) {
    prompt += "\n" + getBrandKitPrompt(brandKit);
  }
  if (options?.byobSchema?.tables?.length) {
    prompt += getByobSystemPrompt(options.byobSchema);
  }
  if (options?.storeBrief) {
    prompt += getStoreSystemPrompt(options.storeBrief);
  } else if (
    wantsCommerceShip({
      title: options?.userMessage,
      code: previousCode,
    })
  ) {
    prompt += `

## AGENT-READY STORE (platform catalog)
The studio preview AND eject already provide these identifiers. Treat them as globals. NEVER declare, redeclare, export, or import them in any generated file (not Component.tsx, not lib/catalog.ts, not a local PRODUCTS = CATALOG.products):
- PRODUCTS, CATALOG, getProduct, searchProducts, formatMoney, createCheckoutSession
Preview concatenates every file into one script. A second const PRODUCTS throws "Identifier 'PRODUCTS' has already been declared" and the storefront never paints.
Do not emit lib/catalog.ts, app/api/**, app/mcp/**, or /.well-known/ucp. Do not write body.line_items or Next.js route handlers. Those files are attached on eject. Only emit src/ UI files (Header, ProductGrid, ProductDetail, Footer, Component).
Product card media is exactly \`${PRODUCT_CARD_MEDIA}\`. \`p.images[0]\` is the platform asset at \`/products/{slug}.svg\` (file \`public/products/{slug}.svg\`). Do not draw inline SVG product icons.
`;
  }
  if (customPrompt) {
    prompt += "\n\nUSER'S CUSTOM GUIDELINES:\n" + customPrompt;
  }
  if (options?.uiLocale === "fr") {
    prompt += localeSystemHint("fr");
  }
  if (previousCode) {
    prompt += getIterationPrompt(previousCode);
  }
  return prompt;
}
