"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Store, Trash2 } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing-page-shell";
import {
  STORE_AUTOGEN_KEY,
  STORE_VIBES,
  type StoreAutogenPayload,
  type StoreVibeId,
} from "@/lib/commerce/store-brief";
import { STORE_BRIEF_KEY } from "@/lib/commerce/wizard-catalog";

interface ProductRow {
  name: string;
  price: string;
  description: string;
}

const EMPTY_ROW = (): ProductRow => ({ name: "", price: "", description: "" });

export default function NewStorePage() {
  const router = useRouter();
  const [storeName, setStoreName] = useState("");
  const [tagline, setTagline] = useState("");
  const [vibe, setVibe] = useState<StoreVibeId>("clean");
  const [products, setProducts] = useState<ProductRow[]>([
    EMPTY_ROW(),
    EMPTY_ROW(),
    EMPTY_ROW(),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const filledCount = useMemo(
    () => products.filter((p) => p.name.trim() && p.price.trim()).length,
    [products]
  );

  function updateProduct(i: number, patch: Partial<ProductRow>) {
    setProducts((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/stores/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName,
          tagline,
          vibe,
          products: products.map((p) => ({
            name: p.name,
            price: p.price,
            description: p.description,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFieldErrors(
          data.fields && typeof data.fields === "object" ? data.fields : {}
        );
        if (res.status === 403) {
          setError(data.error || "Project limit reached.");
          return;
        }
        setError(data.error || "Could not start the store.");
        return;
      }
      const payload: StoreAutogenPayload = {
        sessionId: data.sessionId,
        prompt: data.prompt,
        designStyle: data.designStyle,
        storeBrief: data.storeBrief,
      };
      try {
        sessionStorage.setItem(STORE_AUTOGEN_KEY, JSON.stringify(payload));
        if (payload.storeBrief?.products?.length) {
          sessionStorage.setItem(
            STORE_BRIEF_KEY,
            JSON.stringify(payload.storeBrief)
          );
        }
      } catch {
        /* private mode */
      }
      router.push(`/studio?p=${encodeURIComponent(payload.sessionId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the store.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MarketingPageShell>
      <main className="mx-auto max-w-2xl px-4 py-14">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-400">
          Golden path
        </p>
        <h1 className="mt-3 flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Store className="h-7 w-7 text-orange-400" />
          Start a store
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Name, a few products, a vibe. You land in the studio with v1 already
          building — catalog, UCP/MCP, and eject orders pre-wired. The general
          builder is still there when you want it.
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-8">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Store name
            </span>
            <input
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Cloud Nine Coffee"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-orange-500/50"
            />
            {fieldErrors.storeName && (
              <span className="mt-1 block text-xs text-red-400">
                {fieldErrors.storeName}
              </span>
            )}
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tagline <span className="font-normal">(optional)</span>
            </span>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Roast you can taste"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-orange-500/50"
            />
          </label>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Brand vibe
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {STORE_VIBES.map((v) => {
                const on = vibe === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVibe(v.id)}
                    className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                      on
                        ? "border-orange-500/60 bg-orange-500/10 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-orange-500/40"
                    }`}
                  >
                    <span className="block font-semibold text-foreground">
                      {v.label}
                    </span>
                    <span className="mt-0.5 block text-[11px]">{v.blurb}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Products
            </legend>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Name and a price in dollars (or cents if ≥ 1000). At least one.
            </p>
            <div className="mt-3 space-y-3">
              {products.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-card/60 p-3 sm:grid-cols-[1fr_7rem_1fr_auto]"
                >
                  <input
                    value={p.name}
                    onChange={(e) => updateProduct(i, { name: e.target.value })}
                    placeholder={`Product ${i + 1}`}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-500/50"
                    aria-label={`Product ${i + 1} name`}
                  />
                  <input
                    value={p.price}
                    onChange={(e) => updateProduct(i, { price: e.target.value })}
                    placeholder="$18"
                    inputMode="decimal"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-500/50"
                    aria-label={`Product ${i + 1} price`}
                  />
                  <input
                    value={p.description}
                    onChange={(e) =>
                      updateProduct(i, { description: e.target.value })
                    }
                    placeholder="One-line description"
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-orange-500/50"
                    aria-label={`Product ${i + 1} description`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setProducts((rows) =>
                        rows.length <= 1 ? rows : rows.filter((_, idx) => idx !== i)
                      )
                    }
                    disabled={products.length <= 1}
                    className="inline-flex items-center justify-center rounded-lg border border-border px-2 py-2 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Remove product"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {fieldErrors[`products.${i}.name`] && (
                    <span className="text-xs text-red-400 sm:col-span-4">
                      {fieldErrors[`products.${i}.name`]}
                    </span>
                  )}
                  {fieldErrors[`products.${i}.price`] && (
                    <span className="text-xs text-red-400 sm:col-span-4">
                      {fieldErrors[`products.${i}.price`]}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setProducts((rows) => [...rows, EMPTY_ROW()])}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add product
            </button>
          </fieldset>

          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !storeName.trim() || filledCount < 1}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_40px_-10px_rgba(249,115,22,0.6)] hover:bg-orange-400 disabled:opacity-50 sm:w-auto"
          >
            {busy ? "Opening studio…" : "Build storefront"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </main>
    </MarketingPageShell>
  );
}
