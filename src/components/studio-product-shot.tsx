/**
 * Faithful studio chrome for the homepage hero.
 * Mirrors the Admin Users golden path (seed-admin-users + PROMPT_TEMPLATES),
 * not a generated stock screenshot.
 */
const USERS = [
  { name: "Ada Lovelace", email: "ada@preview.dev", role: "admin" },
  { name: "Grace Hopper", email: "grace@preview.dev", role: "member" },
] as const;

export function StudioProductShot() {
  return (
    <figure className="relative mx-auto mt-14 max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-3 font-mono text-[10px] text-muted-foreground">
          studio · Ready to ship · Push to GitHub
        </span>
        <span className="ml-auto hidden rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-400 sm:inline">
          Ready to ship
        </span>
      </div>
      <div className="grid md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.45fr)]">
        <div className="border-b border-border p-4 md:border-b-0 md:border-r">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Chat
          </p>
          <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-left text-xs leading-relaxed text-foreground/90">
            Build a dense dark SaaS admin Users page… listUsers / createUser /
            deleteUser from @/app/actions
          </p>
          <p className="mt-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-left text-[11px] leading-relaxed text-muted-foreground">
            Built <span className="text-foreground">Users</span> · 3 files ·
            UserTable.tsx, UserForm.tsx, Component.tsx
          </p>
          <p className="mt-3 text-left text-[11px] text-muted-foreground">
            Golden paths: Admin Users · Auth · Kanban
          </p>
        </div>
        <div className="bg-zinc-950 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Preview
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-400">
                  Admin
                </p>
                <p className="text-sm font-bold text-white">Users</p>
              </div>
              <span className="rounded-lg bg-orange-500 px-3 py-1.5 text-[11px] font-semibold text-black">
                Add user
              </span>
            </div>
            <table className="w-full text-left text-[11px] text-zinc-300">
              <thead className="bg-zinc-900 text-[10px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">
                    Email
                  </th>
                  <th className="px-4 py-2 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {USERS.map((u) => (
                  <tr key={u.email} className="border-t border-white/10">
                    <td className="px-4 py-2.5 font-medium text-white">
                      {u.name}
                    </td>
                    <td className="hidden px-4 py-2.5 text-zinc-400 sm:table-cell">
                      {u.email}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <figcaption className="border-t border-border px-4 py-2 text-center text-[11px] text-muted-foreground">
        Admin Users golden path — live preview after generate, then eject to
        GitHub.
      </figcaption>
    </figure>
  );
}
