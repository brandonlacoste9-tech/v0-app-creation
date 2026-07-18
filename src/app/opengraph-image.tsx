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
        title="Describe the idea. Get production UI."
        subtitle="AI compiler for developers — React + Tailwind + TypeScript, BYOB, GitHub, finish in Cursor."
        eyebrow="SHIPBOARD · PUBLIC BETA"
        chips={["Next.js", "Cursor-ready", "BYOB Postgres", "GitHub ship"]}
      />
    ),
    { ...OG_SIZE }
  );
}
