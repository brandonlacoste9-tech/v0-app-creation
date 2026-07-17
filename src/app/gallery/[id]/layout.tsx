import type { Metadata } from "next";
import { storage } from "@/lib/storage";

type Props = { params: Promise<{ id: string }> | { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await Promise.resolve(params);
  try {
    const item = await storage.getGalleryItem(id);
    if (!item) {
      return { title: "Not found · Showcase" };
    }
    const desc =
      item.description?.slice(0, 160) ||
      `Preview and remix “${item.title}” — generated with Shipboard.`;
    return {
      title: item.title,
      description: desc,
      openGraph: {
        title: `${item.title} · Shipboard Showcase`,
        description: desc,
        url: `/gallery/${id}`,
        type: "article",
      },
      twitter: {
        card: "summary",
        title: item.title,
        description: desc,
      },
      alternates: {
        canonical: `/gallery/${id}`,
      },
    };
  } catch {
    return { title: "Showcase" };
  }
}

export default function GalleryItemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
