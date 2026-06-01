import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CALDAV_NOT_CONFIGURED"
  | "CALDAV_SYNC_FAILED"
  | "INTERNAL_ERROR";

export function apiError(code: ApiErrorCode, message: string, status = 500, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}
