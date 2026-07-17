/**
 * Curated design intelligence for AdGenAI generation.
 * Inspired by open design catalogs (styles, palettes, anti-patterns) — compact subset for studio + prompts.
 */

export type DesignStyleId =
  | "auto"
  | "minimal"
  | "glass"
  | "soft"
  | "brutal"
  | "dashboard"
  | "neo"
  | "editorial"
  | "playful"
  | "luxury";

export interface DesignStyle {
  id: DesignStyleId;
  label: string;
  short: string;
  keywords: string;
  palette: string;
  typography: string;
  effects: string;
  bestFor: string;
  avoid: string;
  /** Tailwind-oriented guidance for the model */
  tech: string;
}

/** 9 curated styles + auto (resolved from product keywords). */
export const DESIGN_STYLES: DesignStyle[] = [
  {
    id: "minimal",
    label: "Minimal",
    short: "Clean Swiss",
    keywords: "clean spacious high-contrast geometric grid",
    palette: "Zinc/slate neutrals, single accent (blue or emerald), white or near-black surfaces",
    typography: "Sans headlines tracking-tight; clear hierarchy; body 14–16px",
    effects: "Subtle 150–250ms transitions; little or no shadow; sharp or slightly rounded",
    bestFor: "SaaS, docs, developer tools, enterprise",
    avoid: "Heavy gradients, neon, decorative noise",
    tech: "bg-white/zinc-950, border-zinc-200/800, rounded-lg, gap-6/8, max-w-6xl",
  },
  {
    id: "glass",
    label: "Glass",
    short: "Frosted depth",
    keywords: "frosted glass blur layered modern premium",
    palette: "Dark or vivid backdrop; translucent cards rgba; electric blue/violet accents",
    typography: "Modern sans; strong CTAs",
    effects: "backdrop-blur, 1px light borders, soft z-depth, soft glow on CTA",
    bestFor: "Modern SaaS, AI products, modals, dashboards",
    avoid: "Low-contrast text on glass; performance-heavy blur everywhere",
    tech: "backdrop-blur-xl bg-white/10 border-white/20 rounded-2xl shadow-xl",
  },
  {
    id: "soft",
    label: "Soft UI",
    short: "Calm premium",
    keywords: "soft shadows pastel calm wellness premium organic",
    palette: "Warm neutrals, soft pink/sage/gold accents, light backgrounds preferred",
    typography: "Elegant display + clean sans body",
    effects: "Soft multi-layer shadows, 200–300ms gentle hover, rounded 12–16px",
    bestFor: "Wellness, lifestyle, beauty, lifestyle brands",
    avoid: "Harsh neon, brutalist corners, pure black slabs",
    tech: "rounded-2xl shadow-md bg-stone-50 text-stone-800",
  },
  {
    id: "brutal",
    label: "Brutal",
    short: "Bold raw",
    keywords: "brutalist bold offset high-contrast raw asymmetric",
    palette: "Hard black/white + one loud accent (yellow/red/lime)",
    typography: "Heavy display weights, tight leading on headlines",
    effects: "Hard shadows (offset), thick borders, instant or snappy motion",
    bestFor: "Creative agencies, portfolios, edgy brands",
    avoid: "Enterprise banking calm, medical soft UI",
    tech: "border-2 border-black shadow-[4px_4px_0_#000] rounded-none font-black",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    short: "Dense ops",
    keywords: "dense data cards table chart kpi sidebar",
    palette: "Dark zinc surfaces, muted labels, emerald/blue status colors",
    typography: "Compact UI text; mono for metrics",
    effects: "Tight spacing (8–16px), hover rows, subtle dividers",
    bestFor: "Admin, analytics, internal tools",
    avoid: "Marketing-hero only layouts, huge empty whitespace",
    tech: "grid gap-3/4 text-sm tabular-nums border-border/60 bg-card",
  },
  {
    id: "neo",
    label: "Neo-brutal",
    short: "Playful hard",
    keywords: "neo-brutal pop color chunky fun startup",
    palette: "Cream/off-white base + saturated primaries",
    typography: "Chunky sans, oversized labels",
    effects: "Chunky borders, offset shadows, bouncy micro-interactions",
    bestFor: "Consumer apps, startups, marketing tools",
    avoid: "Serious legal/medical primary UIs",
    tech: "border-2 border-zinc-900 shadow-[3px_3px_0_#18181b] rounded-xl",
  },
  {
    id: "editorial",
    label: "Editorial",
    short: "Magazine",
    keywords: "editorial magazine serif content-first storytelling",
    palette: "Paper/cream or ink dark; restrained accent",
    typography: "Serif headlines + sans body; generous measure",
    effects: "Slow fades, pull quotes, large imagery zones",
    bestFor: "Blogs, media, content products",
    avoid: "Dense multi-metric dashboards",
    tech: "prose max-w-3xl font-serif headlines tracking-tight",
  },
  {
    id: "playful",
    label: "Playful",
    short: "Friendly pop",
    keywords: "playful friendly rounded vibrant soft-motion",
    palette: "Bright but balanced accents on light/dark soft bases",
    typography: "Rounded sans, friendly scale",
    effects: "Scale hover, soft bounce 200ms, rounded-full pills",
    bestFor: "Consumer, education, social, kids-adjacent",
    avoid: "Austere enterprise admin only",
    tech: "rounded-2xl bg-gradient soft, scale-105 hover, gap-4",
  },
  {
    id: "luxury",
    label: "Luxury",
    short: "Quiet rich",
    keywords: "luxury gold elegant sparse premium dark",
    palette: "Near-black, ivory, muted gold #D4AF37 accents",
    typography: "Elegant serif + refined sans; letter-spacing on labels",
    effects: "Slow reveals, thin gold lines, lots of air",
    bestFor: "Premium brands, fashion, high-end services",
    avoid: "Busy tables, neon, meme aesthetics",
    tech: "tracking-widest uppercase labels, gold border accents, py-24",
  },
];

const PRODUCT_STYLE_HINTS: { match: RegExp; styleId: DesignStyleId }[] = [
  { match: /\b(dashboard|admin|analytics|kpi|metrics|ops)\b/i, styleId: "dashboard" },
  { match: /\b(spa|wellness|beauty|meditation|calm|health)\b/i, styleId: "soft" },
  { match: /\b(glass|frost|ai|gpt|llm|chatbot)\b/i, styleId: "glass" },
  { match: /\b(brutal|raw|punk|agency|portfolio)\b/i, styleId: "brutal" },
  { match: /\b(neo.?brutal|startup|fun|consumer)\b/i, styleId: "neo" },
  { match: /\b(blog|magazine|editorial|news|article)\b/i, styleId: "editorial" },
  { match: /\b(playful|kids|social|game|friendly)\b/i, styleId: "playful" },
  { match: /\b(luxury|premium|fashion|hotel|gold)\b/i, styleId: "luxury" },
  { match: /\b(saas|b2b|docs|developer|tool|minimal)\b/i, styleId: "minimal" },
];

export function getDesignStyle(id: DesignStyleId | string | undefined): DesignStyle {
  const found = DESIGN_STYLES.find((s) => s.id === id);
  return found || DESIGN_STYLES[0];
}

/** Resolve auto style from user prompt keywords. */
export function resolveDesignStyle(
  styleId: DesignStyleId | string | undefined,
  userMessage: string
): DesignStyle {
  if (styleId && styleId !== "auto") {
    return getDesignStyle(styleId);
  }
  for (const hint of PRODUCT_STYLE_HINTS) {
    if (hint.match.test(userMessage)) {
      return getDesignStyle(hint.styleId);
    }
  }
  return getDesignStyle("minimal");
}

/**
 * Compact design brief injected into the system prompt for this generation.
 */
export function buildDesignBrief(
  styleId: DesignStyleId | string | undefined,
  userMessage: string
): string {
  const style = resolveDesignStyle(styleId, userMessage);
  return `
## DESIGN BRIEF (apply to this generation)
- Style: ${style.label} — ${style.short}
- Best for: ${style.bestFor}
- Keywords: ${style.keywords}
- Palette: ${style.palette}
- Typography: ${style.typography}
- Effects: ${style.effects}
- Tailwind direction: ${style.tech}
- Style-specific avoid: ${style.avoid}
`.trim();
}

/** Always-on anti-patterns (design quality bar). */
export const DESIGN_ANTI_PATTERNS = `
## ANTI-PATTERNS (never ship these)
- No emoji as icons — use Lucide-style inline SVG paths or simple geometric SVG
- No lorem ipsum, "Feature 1/2/3", or placeholder copy
- No gray-on-gray text; body contrast must read clearly (aim 4.5:1+)
- No missing hover/focus states on buttons, links, tabs, rows
- No hover-only critical actions (mobile must work)
- No layout thrash: reserve space for images/skeletons; avoid jumpy CLS
- No tiny tap targets — interactive controls feel ≥40px tall with spacing
- No instant 0ms state flips — use 150–300ms transitions for UI feedback
- No horizontal page scroll on mobile; stack grids (grid-cols-1 md:grid-cols-*)
- No random mixed visual languages (e.g. neumorph + glass + brutal in one screen)
- Prefer cursor-pointer on clickable elements; visible focus rings
`.trim();
