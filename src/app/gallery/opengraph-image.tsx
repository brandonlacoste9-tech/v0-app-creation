import { ImageResponse } from "next/og";
import { OgCard, OG_SIZE } from "@/lib/og-card";

export const runtime = "edge";
export const alt = "Shipboard Showcase";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <OgCard
        title="Community showcase"
        subtitle="Official starters and community UIs. Remix into studio. Ship production Next.js."
        eyebrow="SHOWCASE"
        chips={["Official seeds", "Remix", "Live preview"]}
      />
    ),
    { ...OG_SIZE }
  );
}
