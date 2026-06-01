import { fromZonedTime } from "date-fns-tz";
import { NextResponse } from "next/server";
import "@/server/services/syncBootstrap";
import { getDashboardToday } from "@/server/services/getDashboardToday";
import { bootstrapSyncScheduler } from "@/server/services/syncBootstrap";
import { env } from "@/server/config/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  bootstrapSyncScheduler();
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const date = dateParam ? fromZonedTime(`${dateParam}T12:00:00`, env.DEFAULT_TIMEZONE) : new Date();
  const dashboard = await getDashboardToday(date);
  return NextResponse.json(dashboard, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}
