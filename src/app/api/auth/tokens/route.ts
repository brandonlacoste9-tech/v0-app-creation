import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-user";
import {
  createPat,
  listPats,
  revokePat,
} from "@/lib/tenant-auth";

export const runtime = "nodejs";

/** List PATs for current user (prefix only — never the secret). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const tokens = await listPats(user.id);
  return NextResponse.json({ tokens });
}

/** Create a CLI PAT. Returns raw token once. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  let name = "CLI token";
  try {
    const body = await req.json();
    if (typeof body.name === "string" && body.name.trim()) {
      name = body.name.trim().slice(0, 80);
    }
  } catch {
    /* empty body ok */
  }

  const { token, raw } = await createPat(user.id, name);
  return NextResponse.json({
    token,
    raw,
    warning:
      "Copy this token now. It will not be shown again. Use: npx shipboard link --token <raw> --session <id>",
  });
}

/** Revoke PAT: DELETE with ?id= */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const ok = await revokePat(user.id, id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
