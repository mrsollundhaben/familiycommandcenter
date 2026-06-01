import { NextResponse } from "next/server";
import { z } from "zod";
import type { CalendarSource } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { isAdminAuthenticated } from "@/server/auth/adminSession";
import { apiError } from "@/lib/errors";

const schema = z.object({
  enabled: z.boolean().optional(),
  defaultRigidity: z.enum(["fixed", "flexible", "optional"]).optional(),
  defaultCategory: z.enum(["appointment", "task", "routine", "reminder"]).optional(),
  defaultPersonIds: z.array(z.string().min(1)).optional(),
  includeInDashboard: z.boolean().optional()
}).strict();

function serializeCalendarSource(calendarSource: CalendarSource) {
  return {
    ...calendarSource,
    defaultPersonIds: Array.isArray(calendarSource.defaultPersonIds)
      ? calendarSource.defaultPersonIds.filter((item): item is string => typeof item === "string")
      : []
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return apiError("UNAUTHORIZED", "Admin session required", 401);

  const { id } = await params;
  const body = schema.safeParse(await request.json());
  if (!body.success) return apiError("VALIDATION_ERROR", "Invalid calendar source update", 400, body.error.flatten());

  const existing = await prisma.calendarSource.findUnique({ where: { id } });
  if (!existing) return apiError("NOT_FOUND", "Calendar source not found", 404);

  const data = body.data;
  const activeMembers = data.defaultPersonIds
    ? await prisma.familyMember.findMany({ where: { id: { in: data.defaultPersonIds }, isActive: true }, select: { id: true } })
    : [];
  const activeMemberIds = new Set(activeMembers.map((member) => member.id));
  const uniqueDefaultPersonIds = data.defaultPersonIds ? [...new Set(data.defaultPersonIds)].filter((memberId) => activeMemberIds.has(memberId)) : undefined;

  const calendarSource = await prisma.calendarSource.update({
    where: { id },
    data: {
      enabled: data.enabled,
      defaultRigidity: data.defaultRigidity,
      defaultCategory: data.defaultCategory,
      defaultPersonIds: uniqueDefaultPersonIds,
      includeInDashboard: data.includeInDashboard
    }
  });

  return NextResponse.json({ calendarSource: serializeCalendarSource(calendarSource) });
}
