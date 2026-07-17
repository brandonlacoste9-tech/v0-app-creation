import { ImageResponse } from "next/og";
import { OgCard, OG_SIZE } from "@/lib/og-card";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";
export const alt = "Shipboard gallery project";
export const size = OG_SIZE;
export const contentType = "image/png";

type Props = { params: Promise<{ id: string }> | { id: string } };

export default async function Image({ params }: Props) {
  const { id } = await Promise.resolve(params);
  let title = "Showcase project";
  let subtitle = "Remix this UI into Shipboard studio and ship Next.js.";
  let chips = ["Remix", "Preview", "Ship"];

  try {
    const item = await storage.getGalleryItem(id);
    if (item) {
      title = item.title.slice(0, 72);
      subtitle =
        (item.description || "").slice(0, 120) ||
        `by @${item.author || "anon"} · generated with Shipboard`;
      if (item.id.startsWith("seed-")) {
        chips = ["Official", "Remix", "Starter"];
      }
    }
  } catch {
    /* fallback card */
  }

  return new ImageResponse(
    (
      <OgCard
        title={title}
        subtitle={subtitle}
        eyebrow="SHOWCASE"
        chips={chips}
      />
    ),
    { ...OG_SIZE }
  );
}
