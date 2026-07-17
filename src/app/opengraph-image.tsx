import { ImageResponse } from "next/og";
import { OgCard, OG_SIZE } from "@/lib/og-card";

export const runtime = "edge";
export const alt = "Shipboard — Describe the idea. Get the UI.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <OgCard
        title="Describe the idea. Get the UI."
        subtitle="Production React + Tailwind. Preview absorbs production dialect. Eject real Next.js."
        chips={["Hybrid single-pass", "BYOB actions", "Ship Next.js"]}
      />
    ),
    { ...OG_SIZE }
  );
}
