import { ImageResponse } from "next/og";
import { OgCard, OG_SIZE } from "@/lib/og-card";

export const runtime = "edge";
export const alt = "Shared Shipboard preview";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <OgCard
        title="Shared preview"
        subtitle="Someone shared a Shipboard UI with you. Open it, remix into studio, ship Next.js."
        eyebrow="SHARE"
        chips={["Live preview", "Remix", "No account required"]}
      />
    ),
    { ...OG_SIZE }
  );
}
