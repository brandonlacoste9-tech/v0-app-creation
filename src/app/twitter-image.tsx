import { ImageResponse } from "next/og";
import { OgCard, OG_SIZE } from "@/lib/og-card";

export const runtime = "edge";
export const alt =
  "Shipboard — AI UI builder for developers. Chat to production Next.js.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <OgCard
        title="AI UI builder for developers"
        subtitle="Production React + Tailwind. Preview, ship to GitHub, finish in Cursor."
        eyebrow="SHIPBOARD"
        chips={["Not no-code", "Eject Next.js", "Public beta"]}
      />
    ),
    { ...OG_SIZE }
  );
}
