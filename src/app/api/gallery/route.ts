import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { getCurrentUser } from "@/lib/get-user";
import { getGitHubToken } from "@/lib/github-token";
import { STARTER_SEEDS } from "@/lib/starter-gallery";

/**
 * Ensure showcase has starter gold examples.
 * Creates missing seeds; refreshes code for existing seed-* items.
 */
async function ensureSeeds() {
  for (const seed of STARTER_SEEDS) {
    try {
      const found = await storage.getGalleryItem(seed.id);
      if (found) {
        await storage.updateGalleryItem(seed.id, {
          title: seed.title,
          description: seed.description,
          code: seed.code,
          theme: seed.theme,
        });
        continue;
      }
      await storage.createGalleryItem({
        id: seed.id,
        title: seed.title,
        description: seed.description,
        code: seed.code,
        theme: seed.theme,
        author: seed.author,
      });
    } catch (e) {
      console.error("Seed gallery item failed:", seed.id, e);
    }
  }
}

export async function GET() {
  try {
    await ensureSeeds();
    const items = await storage.listGallery(60);
    // Don't send full code in list — keep payloads small
    return NextResponse.json(
      items.map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        theme: i.theme,
        author: i.author,
        likes: i.likes,
        createdAt: i.createdAt,
        preview: i.code.slice(0, 200),
        seeded: i.id.startsWith("seed-"),
      }))
    );
  } catch (e) {
    console.error("Gallery list error:", e);
    return NextResponse.json({ error: "Failed to load gallery" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = String(body.code || "").trim();
    const title = String(body.title || "Untitled").slice(0, 120);
    const description = String(body.description || "").slice(0, 400);
    const theme = String(body.theme || "dark-default").slice(0, 64);

    if (!code || code.length < 20) {
      return NextResponse.json(
        { error: "Generate a component before publishing." },
        { status: 400 }
      );
    }
    if (code.length > 400_000) {
      return NextResponse.json({ error: "Project too large to publish." }, { status: 400 });
    }

    const user = await getCurrentUser();
    const gh = await getGitHubToken();
    const author =
      user?.githubUsername || gh?.username || String(body.author || "anonymous").slice(0, 40);

    const item = await storage.createGalleryItem({
      id: crypto.randomUUID(),
      title,
      description,
      code,
      theme,
      author,
    });

    return NextResponse.json({
      id: item.id,
      title: item.title,
      author: item.author,
      createdAt: item.createdAt,
      url: `/gallery/${item.id}`,
    });
  } catch (e) {
    console.error("Gallery publish error:", e);
    return NextResponse.json({ error: "Failed to publish" }, { status: 500 });
  }
}
