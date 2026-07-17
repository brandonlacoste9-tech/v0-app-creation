import { NextResponse } from "next/server";
import { runBrowserTask } from "@/lib/browser";

/**
 * Static browser QA for a version's code.
 * Live DOM QA runs client-side via the preview iframe bridge.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = typeof body?.code === "string" ? body.code : "";
    if (!code.trim()) {
      return NextResponse.json(
        { error: "code is required" },
        { status: 400 }
      );
    }

    const result = runBrowserTask({
      kind: "preview_qa",
      code,
      viewport: body?.viewport,
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "QA failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
