/** Built-in showcase seeds so /gallery is never empty for new installs. */

export type StarterSeed = {
  id: string;
  title: string;
  description: string;
  theme: string;
  author: string;
  code: string;
};

export const STARTER_SEEDS: StarterSeed[] = [
  {
    id: "seed-saas-landing",
    title: "Shipfast SaaS Landing",
    description: "Dark marketing page with hero, features, metrics, and CTAs.",
    theme: "dark-default",
    author: "adgenai",
    code: `function Component() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-sm">S</span>
          Shipfast
        </div>
        <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a className="hover:text-white" href="#features">Features</a>
          <a className="hover:text-white" href="#proof">Proof</a>
          <a className="rounded-full bg-white px-4 py-2 font-medium text-zinc-950 hover:bg-zinc-200" href="#cta">Start free</a>
        </nav>
        <button type="button" className="md:hidden" onClick={() => setOpen(!open)}>☰</button>
      </header>
      {open && (
        <div className="border-b border-zinc-800 px-6 py-4 text-sm text-zinc-300 md:hidden">
          <a className="block py-2" href="#features">Features</a>
          <a className="block py-2" href="#proof">Proof</a>
        </div>
      )}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 text-center md:pt-24">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">For builders shipping this week</p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          Ship ideas before the hype dies
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-400">
          Turn product prompts into production React UI — preview, iterate, and push to GitHub in one flow.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3" id="cta">
          <button type="button" className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold hover:bg-orange-400">Start free</button>
          <button type="button" className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 hover:border-zinc-500">View docs</button>
        </div>
        <div className="mt-14 flex flex-wrap items-center justify-center gap-8 text-xs uppercase tracking-wider text-zinc-500">
          <span>Vercel</span><span>GitHub</span><span>Stripe</span><span>Neon</span>
        </div>
      </section>
      <section id="features" className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 md:grid-cols-3">
        {[
          { t: "Live preview", d: "Watch the UI assemble as the model streams." },
          { t: "Multi-file", d: "Hero, Navbar, Pricing — real project structure." },
          { t: "One-click GitHub", d: "Push a full Vite app without copy-paste." },
        ].map((f) => (
          <div key={f.t} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-left">
            <h3 className="text-lg font-semibold">{f.t}</h3>
            <p className="mt-2 text-sm text-zinc-400">{f.d}</p>
          </div>
        ))}
      </section>
      <section id="proof" className="border-t border-zinc-800 bg-zinc-900/40 py-12">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-10 px-6 text-center">
          {[{ n: "12k+", l: "UIs generated" }, { n: "4.9★", l: "Builder rating" }, { n: "3 min", l: "Idea → repo" }].map((m) => (
            <div key={m.l}>
              <div className="text-3xl font-bold text-white">{m.n}</div>
              <div className="mt-1 text-xs text-zinc-500">{m.l}</div>
            </div>
          ))}
        </div>
      </section>
      <footer className="mx-auto max-w-6xl px-6 py-10 text-center text-xs text-zinc-600">
        Built with AdGenAI · Shipfast demo
      </footer>
    </div>
  );
}
`,
  },
  {
    id: "seed-pricing",
    title: "Pricing with Annual Toggle",
    description: "Three tiers, monthly/annual switch, FAQ accordion.",
    theme: "dark-default",
    author: "adgenai",
    code: `function Component() {
  const [annual, setAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState(0);
  const tiers = [
    { name: "Free", price: 0, feats: ["5 gens / day", "3 projects", "ZIP export"] },
    { name: "Pro", price: annual ? 12 : 15, feats: ["Unlimited gens", "Unlimited projects", "GitHub push", "All providers"], hot: true },
    { name: "Team", price: annual ? 29 : 39, feats: ["Everything in Pro", "Shared workspace", "Priority support"] },
  ];
  const faqs = [
    { q: "Can I cancel anytime?", a: "Yes. Pro is month-to-month; annual is prepaid with a prorated refund policy." },
    { q: "Do free users get GitHub push?", a: "Yes — connect GitHub and push a full Vite project from the studio." },
    { q: "What models are included?", a: "Free: Grok / Groq / Ollama. Pro unlocks all providers and higher limits." },
  ];
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl text-center">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Simple pricing</h1>
        <p className="mt-3 text-zinc-400">Start free. Upgrade when you ship every day.</p>
        <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900 p-1 text-sm">
          <button type="button" onClick={() => setAnnual(false)} className={"rounded-full px-4 py-2 " + (!annual ? "bg-white text-zinc-950" : "text-zinc-400")}>Monthly</button>
          <button type="button" onClick={() => setAnnual(true)} className={"rounded-full px-4 py-2 " + (annual ? "bg-white text-zinc-950" : "text-zinc-400")}>
            Annual <span className="ml-1 text-[10px] text-emerald-500">-20%</span>
          </button>
        </div>
      </div>
      <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
        {tiers.map((t) => (
          <div key={t.name} className={"rounded-2xl border p-6 text-left " + (t.hot ? "border-emerald-500/50 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900/50")}>
            {t.hot && <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Recommended</span>}
            <h3 className="mt-2 text-xl font-semibold">{t.name}</h3>
            <div className="mt-4">
              <span className="text-4xl font-bold">\${t.price}</span>
              <span className="text-sm text-zinc-500">/mo</span>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-zinc-300">
              {t.feats.map((f) => <li key={f}>✓ {f}</li>)}
            </ul>
            <button type="button" className={"mt-8 w-full rounded-xl py-2.5 text-sm font-semibold " + (t.hot ? "bg-emerald-500 text-zinc-950" : "border border-zinc-700")}>
              {t.price === 0 ? "Get started" : "Upgrade"}
            </button>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-16 max-w-2xl">
        <h2 className="mb-4 text-center text-lg font-semibold">FAQ</h2>
        {faqs.map((f, i) => (
          <button key={f.q} type="button" onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="mb-2 w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-left">
            <div className="flex justify-between text-sm font-medium">
              <span>{f.q}</span>
              <span className="text-zinc-500">{openFaq === i ? "−" : "+"}</span>
            </div>
            {openFaq === i && <p className="mt-2 text-sm text-zinc-400">{f.a}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}
`,
  },
  {
    id: "seed-waitlist",
    title: "AI Waitlist Capture",
    description: "Hero email form with success state and sticky mobile CTA.",
    theme: "dark-default",
    author: "adgenai",
    code: `function Component() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (email.includes("@")) setDone(true);
  };
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-3xl px-6 pb-28 pt-24 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
          Private beta
        </div>
        <h1 className="text-5xl font-bold tracking-tight md:text-6xl">AI that builds with you</h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-zinc-400">
          Join founders and engineers on the waitlist for early access.
        </p>
        <div className="mx-auto mt-10 max-w-md">
          {!done ? (
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-zinc-600"
              />
              <button type="submit" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-200">
                Join waitlist
              </button>
            </form>
          ) : (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
              <div className="text-4xl">🎉</div>
              <p className="mt-3 text-xl font-semibold">You're in.</p>
              <p className="mt-1 text-sm text-zinc-400">We'll email you when seats open.</p>
            </div>
          )}
        </div>
        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {[
            { i: "⚡", t: "10× faster", d: "Prompt → UI in minutes" },
            { i: "🧠", t: "Iterate in chat", d: "Polish without starting over" },
            { i: "🚀", t: "Ship to GitHub", d: "One click, full Vite app" },
          ].map((b) => (
            <div key={b.t} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="text-2xl">{b.i}</div>
              <div className="mt-2 font-semibold">{b.t}</div>
              <div className="text-sm text-zinc-400">{b.d}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950/95 p-4 backdrop-blur md:hidden">
        <button type="button" onClick={() => document.querySelector("input")?.focus()} className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950">
          Join the waitlist
        </button>
      </div>
    </div>
  );
}
`,
  },
  {
    id: "seed-dashboard",
    title: "SaaS Admin Dashboard",
    description: "Sidebar, KPIs, activity feed, and projects table.",
    theme: "dark-default",
    author: "adgenai",
    code: `function Component() {
  const [collapsed, setCollapsed] = useState(false);
  const nav = ["Overview", "Projects", "Customers", "Billing", "Settings"];
  const kpis = [
    { l: "MRR", v: "$48.2k", d: "+12%" },
    { l: "Active users", v: "3,841", d: "+8%" },
    { l: "Churn", v: "2.1%", d: "-0.4%" },
    { l: "NPS", v: "62", d: "+3" },
  ];
  const rows = [
    { n: "Acme AI", s: "Live", m: "$2.4k" },
    { n: "Northwind", s: "Trial", m: "$0" },
    { n: "Orbit Labs", s: "Live", m: "$890" },
    { n: "PixelForge", s: "Past due", m: "$1.1k" },
  ];
  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <aside className={(collapsed ? "w-16" : "w-56") + " border-r border-zinc-800 bg-zinc-900/40 p-3 transition-all"}>
        <button type="button" onClick={() => setCollapsed(!collapsed)} className="mb-6 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-zinc-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 font-bold">A</span>
          {!collapsed && <span className="font-semibold">Admin</span>}
        </button>
        <nav className="space-y-1">
          {nav.map((item, i) => (
            <div key={item} className={"rounded-lg px-3 py-2 text-sm " + (i === 0 ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/60")}>
              {collapsed ? item[0] : item}
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Overview</h1>
            <p className="text-sm text-zinc-500">Last 30 days</p>
          </div>
          <input placeholder="Search…" className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.l} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="text-xs text-zinc-500">{k.l}</div>
              <div className="mt-1 text-2xl font-bold">{k.v}</div>
              <div className="text-xs text-emerald-400">{k.d}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold">Revenue</h2>
            <div className="flex h-40 items-end gap-2">
              {[40, 55, 48, 70, 62, 80, 75, 90, 85, 95, 88, 100].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-orange-600 to-orange-400" style={{ height: h + "%" }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold">Activity</h2>
            <ul className="space-y-3 text-sm text-zinc-400">
              <li>New signup · Orbit Labs</li>
              <li>Upgrade · Acme AI → Pro</li>
              <li>Invoice paid · PixelForge</li>
              <li>API spike · Northwind</li>
            </ul>
          </div>
        </div>
        <div className="mt-6 overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">MRR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.n} className="border-t border-zinc-800">
                  <td className="px-4 py-3 font-medium text-white">{r.n}</td>
                  <td className="px-4 py-3">
                    <span className={"rounded-full px-2 py-0.5 text-xs " + (r.s === "Live" ? "bg-emerald-500/15 text-emerald-400" : r.s === "Trial" ? "bg-blue-500/15 text-blue-400" : "bg-amber-500/15 text-amber-400")}>{r.s}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{r.m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
`,
  },
];
