/**
 * Shared Open Graph / Twitter card layout for next/og ImageResponse.
 * Keep pure JSX — no browser APIs.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;

export type OgCardProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  footer?: string;
  /** Optional badge chips bottom-left */
  chips?: string[];
};

/** Style object tree for ImageResponse (inline styles only). */
export function OgCard({
  title,
  subtitle = "AI compiler for developers · production React + Tailwind",
  eyebrow = "SHIPBOARD",
  footer = "shipboard.ca",
  chips = ["Preview", "Ship Next.js", "BYOB"],
}: OgCardProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "linear-gradient(145deg, #09090b 0%, #18181b 45%, #0c0a09 100%)",
        color: "#fafafa",
        padding: "56px 64px",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        position: "relative",
      }}
    >
      {/* Glow */}
      <div
        style={{
          position: "absolute",
          top: -80,
          right: -40,
          width: 420,
          height: 420,
          borderRadius: 999,
          background: "rgba(249, 115, 22, 0.22)",
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -100,
          left: 80,
          width: 360,
          height: 360,
          borderRadius: 999,
          background: "rgba(16, 185, 129, 0.12)",
          filter: "blur(70px)",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 20, zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 800,
              color: "#09090b",
            }}
          >
            S
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "#fb923c",
            }}
          >
            {eyebrow}
          </div>
        </div>

        <div
          style={{
            fontSize: title.length > 48 ? 52 : 60,
            fontWeight: 800,
            lineHeight: 1.12,
            letterSpacing: "-0.03em",
            maxWidth: 980,
            color: "#fafafa",
          }}
        >
          {title}
        </div>

        {subtitle ? (
          <div
            style={{
              fontSize: 26,
              lineHeight: 1.4,
              color: "#a1a1aa",
              maxWidth: 900,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {chips.map((c) => (
            <div
              key={c}
              style={{
                fontSize: 18,
                fontWeight: 600,
                padding: "10px 18px",
                borderRadius: 999,
                border: "1px solid rgba(249, 115, 22, 0.35)",
                background: "rgba(249, 115, 22, 0.12)",
                color: "#fdba74",
              }}
            >
              {c}
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "#71717a",
            letterSpacing: "0.02em",
          }}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}
