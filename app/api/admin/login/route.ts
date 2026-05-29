import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSession, verifyAdminPin } from "@/server/auth/adminSession";
import { apiError } from "@/lib/errors";

const schema = z.object({ pin: z.string().min(1) });

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await request.json()
    : Object.fromEntries((await request.formData()).entries());
  const body = schema.safeParse(payload);
  if (!body.success) return apiError("VALIDATION_ERROR", "Invalid login payload", 400);
  if (!(await verifyAdminPin(body.data.pin))) return apiError("UNAUTHORIZED", "Invalid admin PIN", 401);
  await createAdminSession();
  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }
  return NextResponse.json({ ok: true });
}
