/**
 * Curated design intelligence for Shipboard generation.
 * Compact style catalog + briefs + anti-patterns for production-looking UI.
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
  /** Concrete layout recipe the model must follow */
  recipe: string;
}

/** 9 curated styles + auto (resolved from product keywords). */
export const DESIGN_STYLES: DesignStyle[] = [
  {
    id: "minimal",
    label: "Minimal",
    short: "Clean Swiss",
    keywords: "clean spacious high-contrast geometric grid",
    palette: "Zinc/slate neutrals, ONE accent only (emerald OR blue — not purple gradients), white or zinc-950",
    typography: "Sans: text-4xl/5xl md:text-6xl font-bold tracking-tight; body text-zinc-600/400",
    effects: "Subtle borders; hover:bg-zinc-100/800; 150–200ms; rounded-lg/xl — no neon glow",
    bestFor: "SaaS, docs, developer tools, enterprise",
    avoid: "Purple gradients, glass blur, neon, emoji icons, busy illustrations",
    tech: "bg-white dark:bg-zinc-950 border-zinc-200/800 rounded-xl gap-6/8 max-w-6xl mx-auto",
    recipe:
      "Navbar (logo + links + CTA) → centered hero (eyebrow + H1 + sub + dual CTAs) → logo strip → 3 feature cards → metrics strip → footer. Light or dark solid surfaces only.",
  },
  {
    id: "glass",
    label: "Glass",
    short: "Frosted depth",
    keywords: "frosted glass blur layered modern premium",
    palette: "Near-black #0a0a0f base, radial/grid texture, translucent white/5–10 cards, ONE accent (violet OR cyan — not both rainbows)",
    typography: "Bold tracking-tight headlines; muted white/60–70 body",
    effects: "backdrop-blur-xl, border-white/10, soft shadow-xl; CTA solid white or single accent glow",
    bestFor: "Modern SaaS, AI products, waitlists, dashboards",
    avoid: "Low-contrast text on glass; blur on every pixel; flat pure-gray pages with no depth",
    tech: "bg-[#0a0a0f] backdrop-blur-xl bg-white/5 border-white/10 rounded-2xl/3xl",
    recipe:
      "Dark full-bleed canvas + subtle grid/radial → frosted nav → hero with glass email card → 3 glass benefit cards → frosted quote → sticky mobile CTA. Interactive form success state required.",
  },
  {
    id: "soft",
    label: "Soft UI",
    short: "Calm premium",
    keywords: "soft shadows pastel calm wellness premium organic",
    palette: "bg-stone-50 / warm white; stone-800 text; soft rose/sage/amber accent (pick one)",
    typography: "Elegant large headlines; relaxed body leading-relaxed",
    effects: "shadow-md multi-layer soft; rounded-2xl; hover:-translate-y-0.5 duration-300",
    bestFor: "Wellness, lifestyle, beauty, coaching brands",
    avoid: "Harsh black slabs, neon, thick brutal borders",
    tech: "bg-stone-50 text-stone-800 rounded-2xl shadow-md border-stone-200/80",
    recipe:
      "Airy light canvas → soft nav → hero with pastel accent blob (CSS gradient only) → 3 soft cards → testimonial → gentle footer. Calm CTAs, no hard black buttons unless small.",
  },
  {
    id: "brutal",
    label: "Brutal",
    short: "Bold raw",
    keywords: "brutalist bold offset high-contrast raw asymmetric",
    palette: "Pure black/white + ONE loud accent (yellow #facc15 OR lime OR red)",
    typography: "font-black uppercase/tight headlines; huge type",
    effects: "border-2 border-black shadow-[4px_4px_0_#000]; snappy hover:translate",
    bestFor: "Creative agencies, portfolios, edgy brands",
    avoid: "Soft glass, purple SaaS gradients, muted corporate blue-gray only",
    tech: "border-2 border-black shadow-[4px_4px_0_#000] rounded-none font-black bg-white",
    recipe:
      "Hard white or cream page → thick-border nav → massive asymmetric hero → offset-shadow cards grid → bold footer bar. High contrast always.",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    short: "Dense ops",
    keywords: "dense data cards table chart kpi sidebar",
    palette: "bg-zinc-950, zinc-900 panels, muted zinc-500 labels, emerald/amber status chips",
    typography: "text-sm UI; tabular-nums for metrics; compact",
    effects: "gap-3/4; hover:bg-zinc-800/50 rows; subtle borders; no marketing hero",
    bestFor: "Admin, analytics, internal tools",
    avoid: "Marketing landing layout, huge empty whitespace, only 1 KPI card",
    tech: "flex min-h-screen bg-zinc-950 text-sm gap-3/4 rounded-xl border-zinc-800",
    recipe:
      "Collapsible sidebar + main: page title + search → 4 KPI cards → chart panel + activity list → data table with status badges. useState for collapse/filter. Dense ops density.",
  },
  {
    id: "neo",
    label: "Neo-brutal",
    short: "Playful hard",
    keywords: "neo-brutal pop color chunky fun startup",
    palette: "Cream/off-white #faf7f2 + saturated primaries (blue/pink/yellow blocks)",
    typography: "Chunky bold labels; oversized section titles",
    effects: "border-2 border-zinc-900 shadow-[3px_3px_0_#18181b] rounded-xl; bouncy hover",
    bestFor: "Consumer apps, startups, marketing tools",
    avoid: "Serious medical/legal primary UI, pure glass dark AI look",
    tech: "bg-[#faf7f2] border-2 border-zinc-900 shadow-[3px_3px_0_#18181b] rounded-xl",
    recipe:
      "Cream canvas → chunky logo nav → big headline block → colorful offset cards → pop CTA. Fun but readable; interactive toggle or tabs.",
  },
  {
    id: "editorial",
    label: "Editorial",
    short: "Magazine",
    keywords: "editorial magazine serif content-first storytelling",
    palette: "Paper cream #f5f0e8 or ink #111; single restrained accent (rust or navy)",
    typography: "font-serif headlines tracking-tight; sans body max-w-prose",
    effects: "Generous whitespace; thin rules; large pull quotes; slow hover underline",
    bestFor: "Blogs, media, content products, long-form",
    avoid: "Dense KPI dashboards, neon cards, multi-color chaos",
    tech: "bg-[#f5f0e8] text-zinc-900 font-serif for h1/h2; max-w-3xl prose",
    recipe:
      "Masthead + date → large serif H1 → byline → 2-col article intro → pull quote → related stories cards → minimal footer.",
  },
  {
    id: "playful",
    label: "Playful",
    short: "Friendly pop",
    keywords: "playful friendly rounded vibrant soft-motion",
    palette: "Soft light base + 2 bright accents max (e.g. sky + pink); avoid muddy mixes",
    typography: "Rounded friendly scale; bold but not black-letter brutal",
    effects: "rounded-2xl/full pills; hover:scale-105 duration-200; soft gradients sparingly",
    bestFor: "Consumer, education, social, onboarding",
    avoid: "Austere enterprise-only chrome, pure brutal black borders",
    tech: "rounded-2xl rounded-full bg-sky-50 text-sky-950 hover:scale-[1.02]",
    recipe:
      "Friendly nav → mascot-free hero with pill badges → 3 rounded feature cards with simple SVG icons → CTA band → soft footer. Interactive: tab or step picker.",
  },
  {
    id: "luxury",
    label: "Luxury",
    short: "Quiet rich",
    keywords: "luxury gold elegant sparse premium dark",
    palette: "Near-black #0c0c0c, ivory text, muted gold #C9A227 accents ONLY for lines/labels",
    typography: "tracking-[0.2em] uppercase micro-labels; large elegant H1; airy py-20+",
    effects: "Thin gold borders; lots of negative space; no chunky shadows; slow hover opacity",
    bestFor: "Premium brands, fashion, hotels, high-end services",
    avoid: "Busy tables, neon, meme UI, purple AI gradients, emoji",
    tech: "bg-[#0c0c0c] text-stone-100 border border-[#C9A227]/40 tracking-widest uppercase text-xs",
    recipe:
      "Sparse dark page → thin gold rule nav → oversized quiet hero (few words) → one full-bleed content band → membership CTA with gold outline button → minimal footer. Luxury = less UI, more air.",
  },
];

const PRODUCT_STYLE_HINTS: { match: RegExp; styleId: DesignStyleId }[] = [
  { match: /\b(dashboard|admin|analytics|kpi|metrics|ops|kanban)\b/i, styleId: "dashboard" },
  { match: /\b(spa|wellness|beauty|meditation|calm|health|coaching)\b/i, styleId: "soft" },
  { match: /\b(glass|frost|ai|gpt|llm|chatbot|waitlist)\b/i, styleId: "glass" },
  { match: /\b(brutal|raw|punk|agency|portfolio)\b/i, styleId: "brutal" },
  { match: /\b(neo.?brutal|startup|fun|consumer)\b/i, styleId: "neo" },
  { match: /\b(blog|magazine|editorial|news|article|docs)\b/i, styleId: "editorial" },
  { match: /\b(playful|kids|social|game|friendly|onboarding)\b/i, styleId: "playful" },
  { match: /\b(luxury|premium|fashion|hotel|gold|boutique)\b/i, styleId: "luxury" },
  { match: /\b(saas|b2b|developer|tool|minimal|pricing)\b/i, styleId: "minimal" },
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
  const autoNote =
    !styleId || styleId === "auto"
      ? `\n- Selection: Auto-resolved from product keywords (or Minimal default)`
      : `\n- Selection: User chose **${style.label}** — commit fully; do not drift to another style`;
  return `
## DESIGN BRIEF (apply to this generation)${autoNote}
- Style: ${style.label} — ${style.short}
- Best for: ${style.bestFor}
- Keywords: ${style.keywords}
- Palette: ${style.palette}
- Typography: ${style.typography}
- Effects: ${style.effects}
- Tailwind direction: ${style.tech}
- MUST FOLLOW RECIPE: ${style.recipe}
- Style-specific avoid: ${style.avoid}
- First viewport wow: within ~100vh the primary value prop + primary CTA must be obvious (no empty gray slab)
- Visual cohesion: every section must look like the same product — one radius language, one accent, one type scale
- Density: landings need ≥4 distinct sections; dashboards need sidebar + ≥4 KPIs + table or chart (never one lonely card)
`.trim();
}

/** Always-on anti-patterns (design quality bar). */
export const DESIGN_ANTI_PATTERNS = `
## ANTI-PATTERNS (never ship these)
- No emoji as icons — use Lucide-style inline SVG paths or simple geometric SVG
- No lorem ipsum, "Feature 1/2/3", "Coming soon…", or placeholder copy
- Never write "previous content remains", "[...]", or "rest unchanged" — always full file sources
- No incomplete multi-file rewrites: every file you return must be complete and runnable
- No gray-on-gray text; body contrast must read clearly (aim 4.5:1+)
- No missing hover/focus states on buttons, links, tabs, rows
- No hover-only critical actions (mobile must work)
- No layout thrash: reserve space for images/skeletons; avoid jumpy CLS
- No tiny tap targets — interactive controls feel ≥40px tall with spacing
- No instant 0ms state flips — use 150–300ms transitions for UI feedback
- No horizontal page scroll on mobile; stack grids (grid-cols-1 md:grid-cols-*)
- No random mixed visual languages (e.g. neumorph + glass + brutal in one screen)
- Prefer cursor-pointer on clickable elements; visible focus rings
- Avoid generic purple-on-white mesh gradient "AI slop" unless the brief is Glass/AI and still keep ONE accent
- Landing pages need: navbar + hero with primary CTA + ≥3 concrete features + social proof or metrics + footer
- Dashboards need: sidebar or top nav + ≥4 KPI cards + primary table/chart area + filters — not a single empty card
- Forms that matter (waitlist, contact, login) MUST use useState success/error UI — never dead submits
`.trim();
