/**
 * Preview defense fixtures — real production-dialect TSX shapes the model emits.
 *
 * Principle: don't make the model write "preview dialect." These fixtures are the
 * regression wall for sanitize + heal + Babel mount when models drift (format,
 * generics, FC style) or streams cut mid-token.
 *
 * Categories:
 *   - syntax: type/syntax variations that must strip clean for react-only Babel
 *   - stream: incomplete mid-generation sources that must not crash the iframe
 *   - product: denser multi-hook / multi-file-ish shapes closer to real gens
 *
 * Add a fixture when:
 *   - a red panel appears for a new model dialect
 *   - OpenRouter model swap changes type formatting
 *   - truncation heals incorrectly for a new cut site
 */

export type FixtureCategory = "syntax" | "stream" | "product";

export interface PreviewFixture {
  /** Stable id — used in failure messages and CI logs */
  id: string;
  category: FixtureCategory;
  /** One-line why this shape matters */
  why: string;
  /** Raw LLM-like source (may include TS, imports, truncation) */
  source: string;
  /**
   * When true, source is intentionally incomplete — we only require
   * makePreviewSafeSource / wrapCodeForPreview to survive, not a perfect strip.
   */
  truncated?: boolean;
  /** Substrings that must NOT remain after sanitize (complete fixtures only) */
  mustStrip?: string[];
  /** Substrings that must remain after sanitize */
  mustKeep?: string[];
}

export const PREVIEW_FIXTURES: PreviewFixture[] = [
  // ── syntax: model formatting variants ───────────────────────────────────
  {
    id: "simple-component",
    category: "syntax",
    why: "Baseline clean Component() with no types",
    source: `function Component() {
  return <div className="min-h-screen p-8 text-white bg-zinc-950"><h1>Hi</h1></div>;
}`,
    mustKeep: ["function Component", "min-h-screen"],
  },
  {
    id: "interface-props-destructure",
    category: "syntax",
    why: "interface Props + ({ title }: Props) — classic red-code source",
    source: `interface Props {
  title: string;
  count?: number;
}
function Component({ title, count = 0 }: Props) {
  return <div className="p-4">{title}{count}</div>;
}`,
    mustStrip: ["interface Props", ": Props"],
    mustKeep: ["function Component", "title", "className"],
  },
  {
    id: "single-line-interface",
    category: "syntax",
    why: "Single-line interface must not swallow the following function body",
    source: `interface Props { title: string }
function Component({ title }: Props) {
  const [n, setN] = useState<number>(0);
  return <div className="p-4" onClick={() => setN(n + 1)}>{title}{n}</div>;
}`,
    mustStrip: ["interface Props", ": Props", "useState<number>"],
    mustKeep: ["function Component({ title })", "useState(0)"],
  },
  {
    id: "nested-interface-fields",
    category: "syntax",
    why: "Nested object types inside interface bodies",
    source: `interface User {
  id: string;
  profile: { name: string; avatarUrl?: string };
}
interface Props {
  user: User;
  onSelect: (id: string) => void;
}
function Component({ user, onSelect }: Props) {
  return (
    <button className="p-3 rounded-lg" onClick={() => onSelect(user.id)}>
      {user.profile.name}
    </button>
  );
}`,
    mustStrip: ["interface User", "interface Props", ": Props"],
    mustKeep: ["function Component", "onSelect", "user.profile.name"],
  },
  {
    id: "type-alias-props",
    category: "syntax",
    why: "type Props = { ... } alias style",
    source: `type Props = { label: string; active: boolean };
function Component({ label, active }: Props) {
  return <span className={active ? "text-white" : "text-zinc-500"}>{label}</span>;
}`,
    mustStrip: ["type Props", ": Props"],
    mustKeep: ["function Component", "label"],
  },
  {
    id: "react-fc-inline-props",
    category: "syntax",
    why: "const Component: React.FC<{...}> = — very common model dialect",
    source: `const Component: React.FC<{ name: string; age?: number }> = ({ name, age }) => {
  return <div className="p-4">{name}{age ?? ""}</div>;
}`,
    mustStrip: ["React.FC"],
    mustKeep: ["const Component =", "name"],
  },
  {
    id: "react-fc-named-props",
    category: "syntax",
    why: "React.FC<Props> with separate interface",
    source: `interface CardProps { title: string }
const Component: React.FC<CardProps> = ({ title }) => {
  return <article className="border p-4">{title}</article>;
}`,
    mustStrip: ["interface CardProps", "React.FC"],
    mustKeep: ["const Component =", "title"],
  },
  {
    id: "hook-generics",
    category: "syntax",
    why: "useState/useRef/useMemo/useCallback with type args",
    source: `function Component() {
  const [items, setItems] = useState<string[]>([]);
  const [count, setCount] = useState<number>(0);
  const ref = useRef<HTMLDivElement | null>(null);
  const total = useMemo<number>(() => count * 2, [count]);
  const onAdd = useCallback<(v: string) => void>((v) => {
    setItems((prev) => [...prev, v]);
    setCount((c) => c + 1);
  }, []);
  return (
    <div ref={ref} className="p-6" onClick={() => onAdd("x")}>
      {items.length}/{total}
    </div>
  );
}`,
    mustStrip: [
      "useState<string[]>",
      "useState<number>",
      "useRef<HTMLDivElement",
      "useMemo<number>",
      "useCallback<(v: string)",
    ],
    mustKeep: ["useState([])", "useState(0)", "useRef(null)", "function Component"],
  },
  {
    id: "as-const-and-satisfies",
    category: "syntax",
    why: "as const / as Type / satisfies leftovers",
    source: `function Component() {
  const theme = { mode: "dark" as const, accent: "orange" as string };
  const cfg = { n: 1 } satisfies { n: number };
  const label: string = "ok";
  return <div className="p-2">{theme.mode}{cfg.n}{label}</div>;
}`,
    mustStrip: ["as const", "as string", "satisfies", ": string"],
    mustKeep: ["function Component", "theme.mode"],
  },
  {
    id: "export-default-function",
    category: "syntax",
    why: "export default function Component — Next page style",
    source: `export default function Component() {
  return <main className="min-h-screen p-8">Exported</main>;
}`,
    mustStrip: ["export default"],
    mustKeep: ["function Component", "min-h-screen"],
  },
  {
    id: "export-named-and-const",
    category: "syntax",
    why: "export function + export const cleaned for iframe scope",
    source: `export function Hero() {
  return <h1 className="text-3xl">Hero</h1>;
}
export const Component = () => {
  return (
    <div className="p-8">
      <Hero />
    </div>
  );
}`,
    mustStrip: ["export function", "export const"],
    mustKeep: ["function Hero", "const Component", "Hero"],
  },
  {
    id: "generic-function-component",
    category: "syntax",
    why: "function Component<TProps>( — rare but breaks react-only hard",
    source: `function Component<T extends { id: string }>(props: T) {
  return <div className="p-2" data-id={props.id}>Item</div>;
}`,
    mustStrip: ["<T extends", "props: T"],
    mustKeep: ["function Component", "props.id"],
  },
  {
    id: "enum-before-component",
    category: "syntax",
    why: "enum declarations must not leak into Babel react-only",
    source: `enum Status {
  Idle = "idle",
  Loading = "loading",
}
function Component() {
  const s = "idle";
  return <div className="p-4">{s}</div>;
}`,
    mustStrip: ["enum Status"],
    mustKeep: ["function Component"],
  },
  {
    id: "actions-import",
    category: "syntax",
    why: "@/app/actions import must strip; intercept may inline stubs later",
    source: `import { listUsers, createUser } from "@/app/actions";
import type { User } from "@/lib/db/schema";
function Component() {
  useEffect(() => {
    listUsers().then(console.log);
  }, []);
  return <div className="p-4">Users</div>;
}`,
    mustStrip: ['from "@/app/actions"', "import type"],
    mustKeep: ["function Component", "listUsers"],
  },
  {
    id: "third-party-imports",
    category: "syntax",
    why: "lucide/next/image style imports become bare identifiers after strip",
    source: `import { ArrowRight, Star } from "lucide-react";
import Image from "next/image";
function Component() {
  return (
    <div className="flex gap-2 items-center">
      <Star className="w-4 h-4" />
      <span>Featured</span>
      <ArrowRight className="w-4 h-4" />
    </div>
  );
}`,
    mustStrip: ["from \"lucide-react\"", "from \"next/image\"", "import Image"],
    mustKeep: ["function Component", "Featured"],
  },
  {
    id: "tuple-and-var-annotations",
    category: "syntax",
    why: "const [a,b]: [T,U] and const x: string =",
    source: `function Component() {
  const [n, setN]: [number, (v: number) => void] = useState(0 as number);
  const x: string = "hi";
  return <div className="p-4">{n}{x}</div>;
}`,
    mustStrip: [": [number", "as number", ": string"],
    mustKeep: ["useState(0)", "function Component"],
  },
  {
    id: "pricing-object-literals",
    category: "syntax",
    why: "Must NOT turn { price: 0 } into shorthand { price } (ReferenceError)",
    source: `function Component() {
  const annual = false;
  const plans = [
    { name: "Free", price: 0, features: ["A"] },
    { name: "Builder", price: 15, cta: "Start" },
    { name: "Pro", price: annual ? 20 : 25 },
  ];
  return (
    <div className="p-8">
      {plans.map((p) => (
        <div key={p.name}>{p.name}: {p.price}</div>
      ))}
    </div>
  );
}`,
    mustKeep: ["price: 0", "price: 15", "price: annual", "function Component", "plans.map"],
    mustStrip: [],
  },
  {
    id: "role-object-literals",
    category: "syntax",
    why: "Must NOT turn { role: \"admin\" } or { role: Admin } into shorthand",
    source: `function Component() {
  const Admin = "admin";
  const team = [
    { name: "Ada", role: "admin" },
    { name: "Lin", role: "member" },
    { name: "Root", role: Admin },
  ];
  return (
    <ul className="p-6">
      {team.map((u) => (
        <li key={u.name}>{u.name} — {u.role}</li>
      ))}
    </ul>
  );
}`,
    mustKeep: ['role: "admin"', 'role: "member"', "role: Admin", "function Component"],
    mustStrip: [],
  },
  {
    id: "return-type-annotations",
    category: "syntax",
    why: "function foo(): JSX.Element / Promise types on returns",
    source: `function Component(): JSX.Element {
  const load = async (): Promise<void> => {};
  useEffect(() => { void load(); }, []);
  return <div className="p-4">typed return</div>;
}`,
    mustStrip: [": JSX.Element", ": Promise<void>"],
    mustKeep: ["function Component", "typed return"],
  },
  {
    id: "page-entry-alias",
    category: "syntax",
    why: "Some gens use Page() instead of Component() — loader must accept App/Page",
    source: `export default function Page() {
  return <main className="min-h-screen p-10">Page entry</main>;
}`,
    mustKeep: ["function Page", "Page entry"],
  },

  // ── stream: incomplete generation ───────────────────────────────────────
  {
    id: "trunc-mid-classname",
    category: "stream",
    why: "Cut mid-attribute string (token limit mid-landing-page)",
    truncated: true,
    source: `function Component() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <a href="#how" className="py-1 px-
`,
  },
  {
    id: "trunc-mid-jsx-tag",
    category: "stream",
    why: "Cut mid-opening tag",
    truncated: true,
    source: `function Component() {
  return (
    <div className="p-8">
      <section className="grid gap-4
`,
  },
  {
    id: "trunc-mid-string-literal",
    category: "stream",
    why: "Cut mid-double-quoted copy string",
    truncated: true,
    source: `function Component() {
  const headline = "Build production apps with
  return <h1 className="text-4xl">{headline}</h1>;
}
`,
  },
  {
    id: "trunc-mid-function-body",
    category: "stream",
    why: "Cut after opening Component body before return",
    truncated: true,
    source: `function Component() {
  const [open, setOpen] = useState(false);
  const items = [
    { id: 1, label: "One" },
    { id: 2, label: "Tw
`,
  },
  {
    id: "trunc-mid-template-literal",
    category: "stream",
    why: "Cut inside template string / className template",
    truncated: true,
    source: `function Component() {
  const tone = "dark";
  return <div className={\`p-4 \${tone === "dark" ? "bg-zinc-
`,
  },

  // ── product: denser production-like shapes ──────────────────────────────
  {
    id: "landing-hero-typed",
    category: "product",
    why: "Dense landing hero with typed props + hooks (typical gen density)",
    source: `interface HeroProps {
  title: string;
  subtitle?: string;
  ctaLabel: string;
}
type Feature = { title: string; body: string };

const FEATURES: Feature[] = [
  { title: "Ship", body: "Export real Next.js" },
  { title: "Preview", body: "Instant iframe" },
] as const;

function Component({ title, subtitle, ctaLabel }: HeroProps) {
  const [email, setEmail] = useState<string>("");
  const [sent, setSent] = useState<boolean>(false);
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <section className="mx-auto max-w-5xl px-6 py-24">
        <h1 className="text-5xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-4 text-lg text-zinc-400">{subtitle}</p> : null}
        <form
          className="mt-10 flex gap-2"
          onSubmit={(e: React.FormEvent) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <input
            className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
          <button type="submit" className="rounded-lg bg-orange-500 px-5 py-2 font-medium text-black">
            {sent ? "Thanks" : ctaLabel}
          </button>
        </form>
        <ul className="mt-16 grid gap-6 md:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-xl border border-zinc-800 p-5">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}`,
    mustStrip: [
      "interface HeroProps",
      "type Feature",
      ": HeroProps",
      "useState<string>",
      "useState<boolean>",
      "as const",
      "React.FormEvent",
      "React.ChangeEvent",
    ],
    mustKeep: ["function Component", "min-h-screen", "FEATURES.map", "ctaLabel"],
  },
  {
    id: "dashboard-tabs-state",
    category: "product",
    why: "Dashboard shell with union state + typed handlers",
    source: `type Tab = "overview" | "billing" | "settings";

interface Row {
  id: string;
  name: string;
  status: "active" | "paused";
}

function Component() {
  const [tab, setTab] = useState<Tab>("overview");
  const [rows, setRows] = useState<Row[]>([
    { id: "1", name: "Acme", status: "active" },
  ]);

  const onPause = (id: string): void => {
    setRows((prev: Row[]) =>
      prev.map((r: Row) => (r.id === id ? { ...r, status: "paused" as const } : r))
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <nav className="flex gap-3 mb-8">
        {(["overview", "billing", "settings"] as Tab[]).map((t) => (
          <button
            key={t}
            className={tab === t ? "text-orange-400" : "text-zinc-500"}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex justify-between border border-zinc-800 rounded-lg px-4 py-3">
            <span>{r.name}</span>
            <button onClick={() => onPause(r.id)} className="text-sm text-zinc-400">
              {r.status}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}`,
    mustStrip: [
      "type Tab",
      "interface Row",
      "useState<Tab>",
      "useState<Row[]>",
      ": void",
      "as const",
      "as Tab[]",
    ],
    mustKeep: ["function Component", "setTab", "onPause", "rows.map"],
  },
  {
    id: "app-entry-name",
    category: "product",
    why: "function App() entry used by some gens",
    source: `function App() {
  return <div className="p-8 text-white bg-black">App shell</div>;
}`,
    mustKeep: ["function App", "App shell"],
  },
];

export function fixturesByCategory(category: FixtureCategory): PreviewFixture[] {
  return PREVIEW_FIXTURES.filter((f) => f.category === category);
}
