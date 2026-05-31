import { NextResponse } from "next/server";
import { getDashboardToday } from "@/server/services/getDashboardToday";
import { bootstrapSyncScheduler } from "@/server/services/syncBootstrap";

export const runtime = "nodejs";

export async function GET(request: Request) {
  bootstrapSyncScheduler();
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const date = dateParam ? new Date(`${dateParam}T12:00:00`) : new Date();
  const dashboard = await getDashboardToday(date);
  return NextResponse.json(dashboard);
}
