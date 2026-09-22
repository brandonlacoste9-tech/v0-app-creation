import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { loadAdminMetrics } from "@/lib/admin-metrics";
import { getCurrentUser } from "@/lib/get-user";
import { isOwnerUser } from "@/lib/owner-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!isOwnerUser(user?.id)) notFound();
  const metrics = await loadAdminMetrics();
  return NextResponse.json(metrics);
}
