import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/server/auth/adminSession";
import { syncICloudCalendars } from "@/server/services/syncICloudCalendars";
import { apiError } from "@/lib/errors";

export async function POST() {
  if (!(await isAdminAuthenticated())) return apiError("UNAUTHORIZED", "Admin session required", 401);
  const syncLog = await syncICloudCalendars();
  return NextResponse.json({ syncLog });
}
