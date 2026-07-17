import { ImageResponse } from "next/og";
import { OgCard, OG_SIZE } from "@/lib/og-card";

export const runtime = "edge";
export const alt = "Shipboard Studio";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <OgCard
        title="Open the studio"
        subtitle="Golden path: Admin Users · Auth · Kanban. Chat → preview → ship."
        eyebrow="STUDIO"
        chips={["Admin Users", "Auth", "Kanban"]}
      />
    ),
    { ...OG_SIZE }
  );
}
