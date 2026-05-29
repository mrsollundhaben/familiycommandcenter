import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { isAdminAuthenticated } from "@/server/auth/adminSession";
import { apiError } from "@/lib/errors";

const schema = z.object({
  displayName: z.string().min(1),
  shortName: z.string().min(1),
  role: z.enum(["parent", "child"]),
  color: z.string().min(1),
  icon: z.string().optional(),
  sortOrder: z.number().int().default(0)
});

export async function GET() {
  if (!(await isAdminAuthenticated())) return apiError("UNAUTHORIZED", "Admin session required", 401);
  const familyMembers = await prisma.familyMember.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ familyMembers });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return apiError("UNAUTHORIZED", "Admin session required", 401);
  const body = schema.safeParse(await request.json());
  if (!body.success) return apiError("VALIDATION_ERROR", "Invalid family member", 400, body.error.flatten());
  const familyMember = await prisma.familyMember.create({ data: body.data });
  return NextResponse.json({ familyMember }, { status: 201 });
}
