"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const VID_KEY = "sb_vid";

function isLocalHost(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h.endsWith(".local");
}

/**
 * Lightweight first-party visitor beacon (homepage, studio, gallery, share).
 * Skips localhost and preview hosts unless NEXT_PUBLIC_ANALYTICS=1.
 */
export function VisitorBeacon() {
  const pathname = usePathname() || "/";
  const lastSent = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const force = process.env.NEXT_PUBLIC_ANALYTICS === "1";
    if (!force && isLocalHost()) return;
    // Skip Netlify deploy previews unless forced
    if (
      !force &&
      (window.location.hostname.includes("netlify.app") ||
        window.location.hostname.includes("deploy-preview"))
    ) {
      return;
    }

    // Dedupe same path in-session (soft navigation)
    const key = `${pathname}`;
    if (lastSent.current === key) return;
    lastSent.current = key;

    let visitorId = "";
    try {
      visitorId = window.localStorage.getItem(VID_KEY) || "";
      if (!visitorId) {
        visitorId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
        window.localStorage.setItem(VID_KEY, visitorId);
      }
    } catch {
      visitorId = "";
    }

    const payload = {
      path: pathname,
      referrer: document.referrer || "",
      visitorId,
    };

    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/analytics/pageview", blob);
        return;
      }
    } catch {
      /* fall through */
    }

    void fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* ignore */
    });
  }, [pathname]);

  return null;
}
