# Shipboard × Cursor

Positioning and workflows for Cursor / AI-IDE users.

## Positioning (not a replacement)

> **Shipboard generates high-quality, production-ready Next.js foundations and complex features. Export clean code and continue refining everything inside Cursor.**

| Shipboard | Cursor |
|-----------|--------|
| Bootstrap + structured features (Admin, Auth, Kanban) | Day-to-day edit, refactor, multi-file agent |
| Schema → Drizzle + Server Actions (BYOB) | Domain logic, edge cases, integrations |
| Armored live preview (production dialect) | Real server, tests, PR workflows |

We do **not** ask the model for a “preview dialect.” Ejected code is standard App Router.

## Best workflows

### A. Greenfield

1. Studio → golden-path chip (Admin Users / Auth / Kanban)  
2. Connect BYOB if you have Neon/Supabase  
3. Ship / ZIP  
4. `cursor .` → keep building  

### B. Feature drop into an existing app

1. Generate the module in Shipboard (e.g. settings + actions)  
2. Eject or copy `components/` + `app/actions` pieces  
3. In Cursor: merge routes, fix imports, run tests  

### C. Hybrid

`npx shipboard link` + `npx shipboard dev` while Cursor edits local files.

## What Cursor users usually struggle with

- Clean, consistent **backend + Zod + actions** scaffolding  
- **Preview** that doesn’t lie about data behavior  
- Starting large surfaces (dashboard, auth, board) without blank-canvas thrash  

Lean product messaging into those gaps.

## X / #buildinpublic — draft posts

### Post 1 (complementary, not competitive)

```
Cursor is where I finish products.
Shipboard is where I refuse to hand-roll the same Admin CRUD + Drizzle actions again.

Generate production Next.js (real @/app/actions).
Preview that doesn’t invent a second dialect.
Eject → cursor . → ship.

Not a replacement IDE. A trustworthy foundation generator.
```

### Post 2 (backend angle)

```
Hot take for Cursor power users:

AI is great at UI glue.
It’s still flaky at consistent Server Actions + schema-shaped data.

Shipboard: connect Neon → introspect → Drizzle + actions → UI that imports them.
Preview intercepts actions with schema-aware mocks.
Eject is normal Next — open it in Cursor and keep going.
```

### Post 3 (buildinpublic / demo)

```
Building Shipboard in public:

Hybrid single-pass:
• Model writes production TSX only
• Preview absorbs types / truncation / action mocks
• Ship path stays clean Next + Drizzle

Dogfooding Admin Users · Auth · Kanban.
If you live in Cursor, the win is eject quality — not another editor.
```

### Accounts to engage (not spam)

@cursor_ai · @leerob · @v0 · @mckaywrigley · @ericzakariasson · @ayaboch  

Tags: #buildinpublic #cursor #aicoding #nextjs  

Lead with demos (Admin CRUD + eject tree), not “Cursor killer” framing.

## Product checklist (Cursor appeal)

- [x] Production dialect only / clean eject  
- [x] BYOB + schema mocks  
- [x] BETA + Continue in Cursor docs  
- [ ] Optional: “Open in Cursor” deep link / folder open instructions in deploy toast  
- [ ] Optional: VS Code/Cursor extension calling Shipboard generate API  
- [ ] Optional: “export module only” for drop-in features  

## See also

- [BETA.md](../BETA.md) — golden path  
- [DEVELOPERS.md](./DEVELOPERS.md) — architecture  
