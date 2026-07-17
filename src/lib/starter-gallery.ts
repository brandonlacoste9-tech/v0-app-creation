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
    { name: "Free", price: 0, feats: ["5 gens / day", "3 projects", "Grok / Groq / Ollama"] },
    { name: "Builder", price: annual ? 12 : 15, feats: ["40 gens / day", "Unlimited projects", "GitHub push"] },
    { name: "Pro", price: annual ? 20 : 25, feats: ["120 gens / day", "All providers", "Brand kit"], hot: true },
  ];
  const faqs = [
    { q: "Can I cancel anytime?", a: "Yes. Plans are monthly in CAD; cancel anytime from the billing portal." },
    { q: "Do free users get GitHub push?", a: "Yes — connect GitHub and push a full Vite project from the studio." },
    { q: "What models are included?", a: "Free & Builder: Grok / Groq / Ollama / OpenAI. Pro & Max unlock all providers." },
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
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.2),_transparent_50%)]" />
      <div className="relative mx-auto max-w-3xl px-6 pb-28 pt-24 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 backdrop-blur-xl">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
          Private beta
        </div>
        <h1 className="text-5xl font-bold tracking-tight md:text-6xl">AI that builds with you</h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-zinc-400">
          Join founders and engineers on the waitlist for early access.
        </p>
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-xl">
          {!done ? (
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-indigo-400/50"
              />
              <button type="submit" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-200">
                Join waitlist
              </button>
            </form>
          ) : (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 backdrop-blur-xl">
              <svg className="mx-auto h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <p className="mt-3 text-xl font-semibold">You're in.</p>
              <p className="mt-1 text-sm text-zinc-400">We'll email you when seats open.</p>
            </div>
          )}
        </div>
        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {[
            { t: "10× faster", d: "Prompt → UI in minutes" },
            { t: "Iterate in chat", d: "Polish without starting over" },
            { t: "Ship to GitHub", d: "One click, full Vite app" },
          ].map((b) => (
            <div key={b.t} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="mt-2 font-semibold">{b.t}</div>
              <div className="text-sm text-zinc-400">{b.d}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-black/80 p-4 backdrop-blur-xl md:hidden">
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
    id: "seed-glass-waitlist",
    title: "Glass AI Waitlist",
    description: "Frosted dark waitlist — glass style gold example.",
    theme: "dark-default",
    author: "adgenai",
    code: `function Component() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.25),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <nav className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400" />
          Aether
        </div>
        <span className="text-sm text-white/50">Join 12k founders</span>
      </nav>
      <main className="relative z-10 mx-auto max-w-2xl px-6 pb-28 pt-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur-xl">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Early access open
        </div>
        <h1 className="text-5xl font-bold tracking-tight md:text-6xl">The AI that thinks with you</h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-white/60">Real-time reasoning across your docs and tools. Join the private beta.</p>
        <div className="mx-auto mt-10 max-w-md rounded-3xl border border-white/10 bg-white/5 p-2 backdrop-blur-xl">
          {!done ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (email.includes("@")) setDone(true);
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Work email"
                className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-violet-400/50"
              />
              <button type="submit" className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white/90">
                Join waitlist
              </button>
            </form>
          ) : (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-6 text-emerald-300">
              You're on the list. Check your inbox.
            </div>
          )}
        </div>
        <div className="mt-14 grid gap-3 text-left sm:grid-cols-3">
          {[
            { t: "10× decisions", d: "Synthesize context instantly" },
            { t: "Zero switching", d: "Lives in your workflow" },
            { t: "Enterprise", d: "SOC 2, SSO, permissions" },
          ].map((c) => (
            <div key={c.t} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              <div className="font-semibold">{c.t}</div>
              <div className="mt-1 text-sm text-white/50">{c.d}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
`,
  },
  {
    id: "seed-brutal-portfolio",
    title: "Brutal Portfolio",
    description: "Bold raw personal site — brutal style gold example.",
    theme: "light-clean",
    author: "adgenai",
    code: `function Component() {
  const [sent, setSent] = useState(false);
  const projects = [
    { n: "Shipfast", s: "React · Tailwind", d: "AI UI factory for devs" },
    { n: "Northline", s: "Next.js · Neon", d: "Ops dashboard for freelancers" },
    { n: "PixelForge", s: "Vite · Stripe", d: "Asset marketplace MVP" },
  ];
  return (
    <div className="min-h-screen bg-white text-black">
      <header className="flex items-center justify-between border-b-2 border-black px-6 py-4">
        <div className="text-xl font-black tracking-tight">JORDAN LEE</div>
        <nav className="hidden gap-6 text-sm font-bold uppercase md:flex">
          <a href="#work" className="hover:underline">Work</a>
          <a href="#contact" className="hover:underline">Contact</a>
        </nav>
      </header>
      <section className="border-b-2 border-black px-6 py-16 md:py-24">
        <p className="mb-3 inline-block bg-yellow-300 px-2 py-1 text-xs font-black uppercase">Available Q3</p>
        <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
          I BUILD PRODUCTS THAT SHIP LOUD
        </h1>
        <p className="mt-6 max-w-xl text-lg font-medium text-zinc-700">
          Full-stack designer-engineer. React, systems, and zero fluff.
        </p>
        <a href="#contact" className="mt-8 inline-block border-2 border-black bg-black px-6 py-3 text-sm font-black text-white shadow-[4px_4px_0_#000] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_#000]">
          Hire me
        </a>
      </section>
      <section id="work" className="grid border-b-2 border-black md:grid-cols-3">
        {projects.map((p) => (
          <div key={p.n} className="border-b-2 border-black p-6 md:border-b-0 md:border-r-2 last:border-r-0">
            <div className="text-xs font-bold uppercase text-zinc-500">{p.s}</div>
            <h3 className="mt-2 text-2xl font-black">{p.n}</h3>
            <p className="mt-2 font-medium text-zinc-700">{p.d}</p>
          </div>
        ))}
      </section>
      <section id="contact" className="px-6 py-16">
        <h2 className="text-3xl font-black">CONTACT</h2>
        {!sent ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
            className="mt-6 max-w-md space-y-3"
          >
            <input required placeholder="Email" className="w-full border-2 border-black px-4 py-3 font-medium outline-none" />
            <textarea required rows={3} placeholder="Project brief" className="w-full border-2 border-black px-4 py-3 font-medium outline-none" />
            <button type="submit" className="border-2 border-black bg-yellow-300 px-6 py-3 text-sm font-black shadow-[4px_4px_0_#000]">
              Send
            </button>
          </form>
        ) : (
          <div className="mt-6 max-w-md border-2 border-black bg-yellow-300 p-6 font-black">
            Message sent. I'll reply within 48h.
          </div>
        )}
      </section>
    </div>
  );
}
`,
  },
  {
    id: "seed-dashboard",
    title: "SaaS Admin Dashboard",
    description: "Sidebar, KPIs, activity feed, and projects table — dashboard style.",
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
  {
    id: "seed-soft-wellness",
    title: "Soft Wellness Landing",
    description: "Soft UI · calm spa-style landing with booking CTA.",
    theme: "warm-cream",
    author: "adgenai",
    code: `function Component() {
  const [open, setOpen] = useState(false);
  const [booked, setBooked] = useState(false);
  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="text-lg font-semibold tracking-tight">Lumina Spa</div>
        <nav className="hidden gap-8 text-sm text-stone-500 md:flex">
          <a href="#rituals" className="hover:text-stone-800">Rituals</a>
          <a href="#book" className="hover:text-stone-800">Book</a>
        </nav>
        <button type="button" className="md:hidden rounded-lg px-2 py-1 text-sm" onClick={() => setOpen(!open)}>Menu</button>
      </header>
      {open && (
        <div className="border-b border-stone-200 px-6 py-3 text-sm md:hidden">
          <a href="#rituals" className="block py-2">Rituals</a>
          <a href="#book" className="block py-2">Book</a>
        </div>
      )}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-12 text-center md:pt-20">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">Slow down</p>
        <h1 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight text-stone-900 md:text-5xl">
          Rituals that restore your nervous system
        </h1>
        <p className="mx-auto mt-4 max-w-md text-stone-500 leading-relaxed">
          Soft light, warm stone, and therapists who actually listen. Book a 90-minute reset this week.
        </p>
        <a href="#book" className="mt-8 inline-block rounded-2xl bg-stone-800 px-6 py-3 text-sm font-medium text-stone-50 shadow-md transition hover:-translate-y-0.5 hover:bg-stone-700">
          Reserve a session
        </a>
      </section>
      <section id="rituals" className="mx-auto grid max-w-5xl gap-4 px-6 pb-16 md:grid-cols-3">
        {[
          { t: "Grounding massage", d: "90 min · warm oil · quiet room" },
          { t: "Breathwork circle", d: "45 min · small group · guided" },
          { t: "Skin ritual", d: "60 min · botanicals · no sting" },
        ].map((r) => (
          <div key={r.t} className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-md">
            <h3 className="text-lg font-semibold text-stone-900">{r.t}</h3>
            <p className="mt-2 text-sm text-stone-500">{r.d}</p>
          </div>
        ))}
      </section>
      <section id="book" className="border-t border-stone-200 bg-white/80 px-6 py-16">
        <div className="mx-auto max-w-md text-center">
          <h2 className="text-2xl font-semibold">Book your first visit</h2>
          {!booked ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setBooked(true);
              }}
              className="mt-6 space-y-3 text-left"
            >
              <input required placeholder="Email" className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-stone-400" />
              <button type="submit" className="w-full rounded-xl bg-rose-300/80 py-3 text-sm font-semibold text-stone-900 transition hover:bg-rose-300">
                Request time
              </button>
            </form>
          ) : (
            <p className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-6 text-sm text-stone-600">
              Request received. We will email you within one business day.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
`,
  },
  {
    id: "seed-luxury-atelier",
    title: "Luxury Atelier",
    description: "Luxury · sparse dark gold membership page.",
    theme: "dark-default",
    author: "adgenai",
    code: `function Component() {
  const [joined, setJoined] = useState(false);
  return (
    <div className="min-h-screen bg-[#0c0c0c] text-stone-100">
      <header className="mx-auto flex max-w-4xl items-center justify-between border-b border-[#C9A227]/30 px-6 py-6">
        <div className="text-[10px] font-medium uppercase tracking-[0.35em] text-[#C9A227]">Atelier Noir</div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-stone-500">Private</div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-24 text-center md:py-32">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#C9A227]/90">Membership</p>
        <h1 className="mt-6 text-4xl font-light tracking-tight text-stone-50 md:text-5xl">
          Quiet luxury,<br />measured in hours
        </h1>
        <p className="mx-auto mt-8 max-w-md text-sm leading-relaxed text-stone-500">
          A limited circle for collectors and founders. Tailoring, travel desks, and rooms you will never find on a map.
        </p>
        <div className="mx-auto mt-14 max-w-sm border border-[#C9A227]/35 px-6 py-8">
          {!joined ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">Annual</p>
              <p className="mt-2 text-3xl font-light text-stone-50">$12,000</p>
              <button
                type="button"
                onClick={() => setJoined(true)}
                className="mt-8 w-full border border-[#C9A227]/60 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#C9A227] transition hover:bg-[#C9A227]/10"
              >
                Request invitation
              </button>
            </>
          ) : (
            <p className="text-sm text-stone-400">Request received. A concierge will respond within 48 hours.</p>
          )}
        </div>
      </main>
      <footer className="border-t border-[#C9A227]/20 py-10 text-center text-[10px] uppercase tracking-[0.25em] text-stone-600">
        By application only
      </footer>
    </div>
  );
}
`,
  },
  {
    id: "seed-auth-glass",
    title: "Glass Auth",
    description: "Glass · login / signup toggle with marketing panel.",
    theme: "dark-default",
    author: "adgenai",
    code: `function Component() {
  const [mode, setMode] = useState("login");
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="flex min-h-screen bg-[#0a0a0f] text-white">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-white/10 p-10 md:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.25),_transparent_55%)]" />
        <div className="relative text-sm font-semibold tracking-tight">Aether</div>
        <div className="relative max-w-sm">
          <h2 className="text-3xl font-bold tracking-tight">Ship product UI without the blank canvas</h2>
          <p className="mt-3 text-sm text-white/60">Join 12k builders who turn prompts into production React.</p>
        </div>
        <p className="relative text-xs text-white/40">SOC 2 · SSO ready</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-6 flex rounded-xl border border-white/10 bg-black/30 p-1 text-sm">
            <button type="button" onClick={() => setMode("login")} className={"flex-1 rounded-lg py-2 " + (mode === "login" ? "bg-white text-zinc-950" : "text-white/60")}>Log in</button>
            <button type="button" onClick={() => setMode("signup")} className={"flex-1 rounded-lg py-2 " + (mode === "signup" ? "bg-white text-zinc-950" : "text-white/60")}>Sign up</button>
          </div>
          {!done ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setDone(true);
              }}
              className="space-y-3"
            >
              <input required type="email" placeholder="Email" className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-violet-400/50" />
              <div className="relative">
                <input required type={show ? "text" : "password"} placeholder="Password" className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-violet-400/50" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">
                  {show ? "Hide" : "Show"}
                </button>
              </div>
              <button type="submit" className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950 hover:bg-white/90">
                {mode === "login" ? "Continue" : "Create account"}
              </button>
            </form>
          ) : (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-6 text-center text-sm text-emerald-300">
              {mode === "login" ? "Signed in (demo)." : "Account created (demo)."}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className="rounded-xl border border-white/10 py-2.5 text-xs text-white/70 hover:bg-white/5">GitHub</button>
            <button type="button" className="rounded-xl border border-white/10 py-2.5 text-xs text-white/70 hover:bg-white/5">Google</button>
          </div>
        </div>
      </div>
    </div>
  );
}
`,
  },
];
