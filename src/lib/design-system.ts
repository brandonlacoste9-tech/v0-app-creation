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
  | "luxury"
  | "atelier"
  | "street"
  | "clean";

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
  /** Exact Tailwind on the storefront contrast-band <section> */
  contrastBand?: string;
}

/** 9 general styles + 3 storefront-first + auto. */
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
  {
    id: "atelier",
    label: "Atelier",
    short: "Editorial luxury",
    keywords: "atelier editorial luxury serif earth objects collection storefront",
    palette:
      "Paper stone-50 #F7F3EC, ink stone-900, muted umber #8B5E3C for CTAs only, charcoal contrast band #1C1917. Shipboard hairline #E24A2A — not a second fill color.",
    typography:
      "Display: font-serif text-5xl md:text-7xl font-medium tracking-[-0.04em] leading-[0.95]. Body: font-sans text-base leading-relaxed text-stone-600. Hero H1 ends with an umber period. Product index 01/02/03 tracking-[0.2em] tabular-nums text-[11px].",
    effects:
      "Almost no shadow. Thin stone-200 rules. Buttons rounded-none tracking-[0.18em] uppercase text-[11px] border-b-2 border-current hover:bg-stone-900 hover:text-stone-50 duration-200. Image hover:scale-[1.03] duration-300.",
    bestFor: "Objects, home goods, small-batch, quiet fashion",
    avoid:
      "Inter-everywhere, rounded-full pills, purple gradients, fake ★★★★★ reviews, SALE badges, hero carousels, clip-art SVG mix",
    tech: "bg-[#F7F3EC] text-stone-900 font-serif for h1/h2; contrast band bg-[#1C1917] text-stone-100; aspect-[4/5] object-cover",
    contrastBand: "store-contrast w-full bg-[#1C1917] text-stone-100 py-20 md:py-28",
    recipe:
      "Announcement (tracking-[0.2em] uppercase + 2px #E24A2A hairline) → sticky header (serif mark, Shop/Catalog, search+cart icons) → hero ONE message with accent period, no carousel → collection header 'NN OBJECTS / 01 COLLECTION' → product grid on charcoal contrast band (4:5 cards, 01/02/03, formatMoney, quick-add) → editorial feature band (one object, long caption) → trust strip (shipping/returns — no invented names) → newsletter → footer. Flat single-tone pages are banned.",
  },
  {
    id: "street",
    label: "Street",
    short: "Flagship streetwear",
    keywords: "streetwear flagship painterly grain oversized type collectible commerce storefront",
    palette:
      "Ink #0B0B0C and bone #F4EFE6 in hard blocks, never a gray wash. ONE accent #E24A2A for the hairline, the hero period, indexes, and the quick-add. No second accent. No purple mesh. No gradients.",
    typography:
      "Display IS the design: font-sans text-7xl md:text-9xl font-black uppercase tracking-[-0.07em] leading-[0.78]. Hero H1 is one line and ends with an #E24A2A period. Body: text-sm md:text-base leading-relaxed text-zinc-600 max-w-prose. Object index 01/02/03 font-black tabular-nums text-3xl tracking-[-0.04em]. Price is display type, not a caption.",
    effects:
      "Hard edges rounded-none. A fixed grain overlay (one inline SVG feTurbulence at opacity 0.08, pointer-events-none, no video). Hover 300ms ease-out: media scale-[1.04], quick-add slides up from translate-y-2 to 0. Sticky header gains a hairline after scroll. Section enter: opacity and 12px rise, 500ms, once. No parallax, no autoplay, no 5MB media.",
    bestFor: "Streetwear flagships, drops, loud product-first shops",
    avoid:
      "Generic 3-column grids, timid text-3xl heroes, rounded-2xl, glassmorphism, pastel wellness, lorem, invented products, placeholder catalogs, hero video, clip-art icon salad",
    tech: "bg-[#F4EFE6] text-[#0B0B0C] font-black tracking-tighter; contrast bg-black text-white; aspect-[4/5] overflow-hidden",
    contrastBand: "store-contrast w-full bg-black text-white py-16 md:py-24",
    recipe:
      "Announcement (ink strip, one #E24A2A word, tracking-[0.28em] uppercase) → sticky header (wordmark at text-2xl font-black tracking-[-0.06em], Shop/Catalog, search + cart as icons with counts) → hero ONE oversized line, accent period, a single still in a torn-edge frame, no carousel → collection header 'NN OBJECTS / 01 COLLECTION' → product grid on the black contrast band: each card is a collectible (4:5 still, giant 01/02/03, name in uppercase tracking-tight, price via formatMoney in text-2xl, quick-add that fills the card foot on hover and stays visible on touch) → editorial band (one sentence set in display type over the bone ground) → trust strip (shipping, returns, made to be worn — no invented names) → newsletter (one field, black button) → footer (wordmark, four links, no sitemap sludge). Type carries the page. Imagery is dramatic and exact to the merchant's products.",
  },
  {
    id: "clean",
    label: "Clean",
    short: "Shopify-clean",
    keywords: "clean shopify dawn airy product-first grid storefront",
    palette:
      "White / zinc-50 page, zinc-900 ink, zinc-500 meta. CTAs near-black, not rainbow. Shipboard #E24A2A only on the announcement hairline, accent period, and 01/02/03 indexes.",
    typography:
      "Display: font-sans text-5xl md:text-7xl font-semibold tracking-[-0.04em] leading-[1.05]. Body: text-base leading-relaxed text-zinc-600. Not Inter-as-decoration — one sans, two weights. Hero H1 ends with an #E24A2A period. Product index 01/02/03 tracking-[0.2em] tabular-nums.",
    effects:
      "rounded-none or rounded-sm only. Buttons tracking-[0.16em] uppercase text-xs border border-zinc-900 hover:bg-zinc-900 hover:text-white duration-200. Image object-cover + hover:scale-[1.03]. Generous py-20 sections.",
    bestFor: "Everyday goods, DTC, the default merchant store",
    avoid:
      "Hero carousels, gradients, second accent, SALE on every card, fake testimonials, mismatched card heights, clip-art SVGs",
    tech: "bg-white text-zinc-900 max-w-7xl mx-auto; contrast band bg-zinc-950 text-zinc-50; aspect-[4/5] overflow-hidden",
    contrastBand: "store-contrast w-full bg-zinc-950 text-zinc-50 py-20 md:py-28",
    recipe:
      "Announcement (uppercase tracking-[0.2em] + 2px #E24A2A hairline) → sticky header (mark left, Shop/Catalog, search+cart icons) → hero ONE message + accent period, no carousel → collection header 'NN OBJECTS / 01 COLLECTION' → product grid on dark charcoal contrast band ('THE ESSENTIALS') with 4:5 cards, formatMoney, hover quick-add → feature/editorial band → trust strip (shipping / returns / made-to-last — no ★★★★★ names) → newsletter → footer. Dawn-level restraint: if a section does not earn its place, cut it.",
  },
];

const PRODUCT_STYLE_HINTS: { match: RegExp; styleId: DesignStyleId }[] = [
  { match: /\b(dashboard|admin|analytics|kpi|metrics|ops|kanban)\b/i, styleId: "dashboard" },
  { match: /\b(spa|wellness|beauty|meditation|calm|health|coaching)\b/i, styleId: "soft" },
  { match: /\b(glass|frost|ai|gpt|llm|chatbot|waitlist)\b/i, styleId: "glass" },
  { match: /\b(brutal|raw|punk|agency|portfolio)\b/i, styleId: "brutal" },
  { match: /\b(neo.?brutal|startup|fun|consumer)\b/i, styleId: "neo" },
  { match: /\b(atelier|objects collection|small-batch)\b/i, styleId: "atelier" },
  { match: /\b(streetwear|street shop|oversized type)\b/i, styleId: "street" },
  { match: /\b(store|shop|storefront|commerce|catalog|merchant|dtc)\b/i, styleId: "clean" },
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
${
  style.contrastBand
    ? `- CONTRAST BAND (copy these classes onto the collection <section>): className="${style.contrastBand}"
- Inner wrap: className="${CONTRAST_BAND_INNER}"`
    : ""
}
- First viewport wow: within ~100vh logo/name + value prop + primary CTA + intentional background (no empty gray slab)
- Visual cohesion: every section must look like the same product — one radius language, one accent, one type scale
- Density: landings need ≥4 distinct sections (nav, hero, features, proof/footer); dashboards need sidebar + ≥4 KPIs + table or chart (never one lonely card)
- Forms: any waitlist/contact/login must wire loading + success/error useState — never dead submit
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

## COMMERCE BANS (storefronts)
- No fake reviews or invented testimonials ("★★★★★ — Sarah M.", "John D. from Austin")
- No SALE badge on every product, no fake countdown timers, no "only 2 left!" lies
- No lorem-ipsum product copy — descriptions come from the merchant brief
- No more than 2 typefaces, no more than 1 accent + neutrals
- No hero carousels, no auto-playing anything, no parallax gimmicks
- No clip-art SVG mix: one stroke weight, one palette, generous padding — or a real still in a reserved 4:5 slot
- No flat single-tone storefronts — one contrast band (dark grid on a light page, or the reverse)
- No timid headlines (text-3xl hero on a store). Display is text-5xl md:text-7xl+ with tracking-[-0.04em]
`.trim();

/** Shipboard micro-signatures — baked into every storefront style. */
export const SHIPBOARD_SIGNATURES = [
  "Announcement hairline: tracking-[0.2em] uppercase strip with a 2px #E24A2A rule underneath — never a gradient banner.",
  "Accent period: the hero H1 ends with one punctuation mark in the accent color.",
  "Object index: product cards labeled 01/02/03 in tabular tracking-widest type; collection header reads NN OBJECTS / 01 COLLECTION.",
] as const;

export const STOREFRONT_STYLE_IDS = ["atelier", "street", "clean"] as const;
export type StorefrontStyleId = (typeof STOREFRONT_STYLE_IDS)[number];

/** Inner wrap inside the full-bleed contrast band. */
export const CONTRAST_BAND_INNER = "store-contrast-inner mx-auto max-w-7xl px-6 md:px-8";

export const STOREFRONT_CONTRAST_BAND: Record<StorefrontStyleId, string> = {
  atelier: "store-contrast w-full bg-[#1C1917] text-stone-100 py-20 md:py-28",
  street: "store-contrast w-full bg-black text-white py-16 md:py-24",
  clean: "store-contrast w-full bg-zinc-950 text-zinc-50 py-20 md:py-28",
};

export function contrastBandClass(styleId: string | undefined): string {
  if (isStorefrontStyle(styleId)) return STOREFRONT_CONTRAST_BAND[styleId];
  return STOREFRONT_CONTRAST_BAND.clean;
}

export const STOREFRONT_REQUIRED_SECTIONS = [
  "announcement",
  "sticky header",
  "hero",
  "collection",
  "contrast",
  "trust",
  "newsletter",
  "footer",
] as const;

export function isStorefrontStyle(id: string | undefined): id is StorefrontStyleId {
  return STOREFRONT_STYLE_IDS.includes(id as StorefrontStyleId);
}

/** Missing anatomy tokens in a storefront recipe (empty = complete). */
export function missingStorefrontSections(style: DesignStyle): string[] {
  const blob = `${style.recipe}\n${style.typography}\n${style.palette}\n${style.effects}`.toLowerCase();
  return STOREFRONT_REQUIRED_SECTIONS.filter((s) => !blob.includes(s));
}

export function hasDisplayScale(style: DesignStyle): boolean {
  return /text-(5xl|6xl|7xl|8xl|9xl)/.test(style.typography);
}

/** Prompt block for generated stores — product cards, anatomy, imagery. */
export const STOREFRONT_LAWS = `
## STOREFRONT LAWS (Shipboard, not a v0 clone)
${SHIPBOARD_SIGNATURES.map((s) => `- ${s}`).join("\n")}

Anatomy, in order (do not skip): announcement bar → sticky header (mark, Shop/Catalog, search + cart icons) → hero (ONE message, no carousel, accent-colored period on the H1) → collection header "NN OBJECTS / 01 COLLECTION" → product grid on a CONTRAST BAND → editorial/feature band → trust strip (shipping/returns — not fake names) → newsletter → footer.

### CONTRAST BAND (required classes — copy exactly)
The product grid lives in a full-bleed <section className="store-contrast …">. Do not nest it inside a white max-w container.
- Token: \`store-contrast\` on the <section>, \`store-contrast-inner\` on the inner wrap.
- Inner wrap classes: \`${CONTRAST_BAND_INNER}\`
- Clean: \`${STOREFRONT_CONTRAST_BAND.clean}\`
- Atelier: \`${STOREFRONT_CONTRAST_BAND.atelier}\`
- Street: \`${STOREFRONT_CONTRAST_BAND.street}\`
Use the row that matches the chosen vibe. py-20 md:py-28 (street: py-16 md:py-24). Full width, dark surface, light type.

### PRODUCT CARDS
- Consistent aspect-[4/5] overflow-hidden image slot. Hover: scale-[1.03] on the media, 300ms. object-cover. No stretched images, no mismatched card heights.
- Title, price via formatMoney (never raw cents), 01/02/03 index, subtle quick-add (hover on md, always visible on mobile).
- Reserve the 4:5 box even when the media is SVG so merchants can drop photography later without CLS.

### PRODUCT DETAIL
Gallery left + info right on md (not a centered modal blob): title, formatMoney, quantity stepper, Buy CTA, GTIN/brand meta, description from the brief.

### ICONS
Never emit a bare statement like \`'canvas-tote': <svg viewBox="0 0 96 96">\` at statement depth. Babel reports Missing semicolon and the preview stays black. Icons live in one object inside the component: \`const ICONS = { "canvas-tote": <svg viewBox="0 0 96 96" /> }\`. Keys are properties of that object, never siblings of \`return\`.

### IMAGERY
- If generate_image is available, call it ONCE per product with a still-life studio prompt (product only, no people, no logos, vibe lighting). Use the https URL in the 4:5 slot.
- If the tool is missing or errors: one coherent inline-SVG language (same stroke, same palette, generous viewBox padding, geometric still-life) stored in const ICONS. Five matching SVGs beat fifty random ones.
- Never invent unsplash/stock URLs. Never emit /products/*.svg files.
- Street: painterly stills, dramatic light, no hero video, no file over a few hundred KB. Motion is CSS only.
`.trim();
