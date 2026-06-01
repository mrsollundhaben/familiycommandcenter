import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { isAdminAuthenticated } from "@/server/auth/adminSession";
import { apiError } from "@/lib/errors";

const schema = z.object({
  title: z.string().min(1),
  rigidity: z.enum(["fixed", "flexible", "optional"]).default("flexible"),
  dueDate: z.string().date().optional(),
  dueTime: z.string().optional(),
  personIds: z.array(z.string()).default([])
});

export async function GET() {
  if (!(await isAdminAuthenticated())) return apiError("UNAUTHORIZED", "Admin session required", 401);
  const tasks = await prisma.task.findMany({ include: { persons: true }, orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return apiError("UNAUTHORIZED", "Admin session required", 401);
  const body = schema.safeParse(await request.json());
  if (!body.success) return apiError("VALIDATION_ERROR", "Invalid task", 400, body.error.flatten());
  const { personIds, dueDate, ...taskData } = body.data;
  const task = await prisma.task.create({
    data: {
      ...taskData,
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00`) : null,
      persons: { create: personIds.map((familyMemberId) => ({ familyMemberId })) }
    },
    include: { persons: true }
  });
  return NextResponse.json({ task }, { status: 201 });
}
