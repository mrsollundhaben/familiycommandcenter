import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { isAdminAuthenticated } from "@/server/auth/adminSession";
import { apiError } from "@/lib/errors";
import { taskRecurrenceSchema } from "@/domain/tasks/recurrence";

const taskCreateSchema = z.object({
  title: z.string().trim().min(1),
  rigidity: z.enum(["fixed", "flexible", "optional"]).default("flexible"),
  dueDate: z.string().date().nullable().optional(),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm").nullable().optional(),
  recurrence: taskRecurrenceSchema.nullable().optional(),
  personIds: z.array(z.string().min(1)).default([]),
  sortOrder: z.number().int().default(0),
  isDone: z.boolean().default(false)
}).strict();

async function validateActivePersonIds(personIds: string[]) {
  const uniquePersonIds = [...new Set(personIds)];
  if (uniquePersonIds.length === 0) return uniquePersonIds;

  const activeMembers = await prisma.familyMember.findMany({
    where: { id: { in: uniquePersonIds }, isActive: true },
    select: { id: true }
  });
  const activeIds = new Set(activeMembers.map((member) => member.id));
  const invalidIds = uniquePersonIds.filter((id) => !activeIds.has(id));

  if (invalidIds.length > 0) {
    return { invalidIds };
  }

  return uniquePersonIds;
}

export async function GET() {
  if (!(await isAdminAuthenticated())) return apiError("UNAUTHORIZED", "Admin session required", 401);
  const tasks = await prisma.task.findMany({ include: { persons: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) return apiError("UNAUTHORIZED", "Admin session required", 401);
  const body = taskCreateSchema.safeParse(await request.json());
  if (!body.success) return apiError("VALIDATION_ERROR", "Invalid task", 400, body.error.flatten());

  const validatedPersonIds = await validateActivePersonIds(body.data.personIds);
  if (!Array.isArray(validatedPersonIds)) {
    return apiError("VALIDATION_ERROR", "Task contains inactive or unknown family members", 400, { personIds: validatedPersonIds.invalidIds });
  }

  const { title, rigidity, dueDate, dueTime, recurrence, sortOrder, isDone } = body.data;
  const task = await prisma.task.create({
    data: {
      title,
      rigidity,
      dueTime,
      recurrence: recurrence ?? null,
      sortOrder,
      isDone,
      doneAt: isDone ? new Date() : null,
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00`) : null,
      persons: { create: validatedPersonIds.map((familyMemberId) => ({ familyMemberId })) }
    },
    include: { persons: true }
  });

  revalidatePath("/admin/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/today");

  return NextResponse.json({ task }, { status: 201 });
}
