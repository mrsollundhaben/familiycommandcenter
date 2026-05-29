import { NextResponse } from "next/server";
import { prisma } from "@/server/db/prisma";
import { isAdminAuthenticated } from "@/server/auth/adminSession";
import { apiError } from "@/lib/errors";

export async function GET() {
  if (!(await isAdminAuthenticated())) return apiError("UNAUTHORIZED", "Admin session required", 401);
  const logs = await prisma.syncLog.findMany({ orderBy: { startedAt: "desc" }, take: 10 });
  return NextResponse.json({ logs });
}
