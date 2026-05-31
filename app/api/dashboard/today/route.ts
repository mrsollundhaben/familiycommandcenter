import { NextResponse } from "next/server";
import "@/server/services/syncBootstrap";
import { getDashboardToday } from "@/server/services/getDashboardToday";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const date = dateParam ? new Date(`${dateParam}T12:00:00`) : new Date();
  const dashboard = await getDashboardToday(date);
  return NextResponse.json(dashboard);
}
