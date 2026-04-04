import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-user";
import { storage } from "@/lib/storage";

const VALID_CODES = {
  "ADGEN_SAAS_PRO": "pro",
  "ANTIGRAVITY_FREE": "pro",
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await req.json();
    const uppercaseCode = (code || "").toUpperCase().trim();

    if (VALID_CODES[uppercaseCode as keyof typeof VALID_CODES]) {
      const plan = VALID_CODES[uppercaseCode as keyof typeof VALID_CODES] as "free" | "pro";
      if (!storage.updateUser) throw new Error("Storage not initialized");
      await storage.updateUser(user.id, { plan });
      
      return NextResponse.json({ success: true, plan });
    }

    return NextResponse.json({ error: "Invalid promo code" }, { status: 400 });
  } catch (error) {
    console.error("Promo code error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
