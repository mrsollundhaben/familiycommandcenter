import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { isAdminAuthenticated } from "@/server/auth/adminSession";
import { apiError } from "@/lib/errors";
import { taskRecurrenceSchema } from "@/domain/tasks/recurrence";

const paramsSchema = z.object({ id: z.string().min(1) });

const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  rigidity: z.enum(["fixed", "flexible", "optional"]).optional(),
  dueDate: z.string().date().nullable().optional(),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm").nullable().optional(),
  recurrence: taskRecurrenceSchema.nullable().optional(),
  personIds: z.array(z.string().min(1)).optional(),
  sortOrder: z.number().int().optional(),
  isDone: z.boolean().optional()
}).strict().refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

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

function revalidateTaskViews() {
  revalidatePath("/admin/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/today");
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return apiError("UNAUTHORIZED", "Admin session required", 401);

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError("VALIDATION_ERROR", "Invalid task id", 400, parsedParams.error.flatten());
  const { id } = parsedParams.data;
  const body = taskUpdateSchema.safeParse(await request.json());
  if (!body.success) return apiError("VALIDATION_ERROR", "Invalid task update", 400, body.error.flatten());

  const existing = await prisma.task.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return apiError("NOT_FOUND", "Task not found", 404);

  const validatedPersonIds = body.data.personIds ? await validateActivePersonIds(body.data.personIds) : undefined;
  if (validatedPersonIds && !Array.isArray(validatedPersonIds)) {
    return apiError("VALIDATION_ERROR", "Task contains inactive or unknown family members", 400, { personIds: validatedPersonIds.invalidIds });
  }

  const data = {
    ...(body.data.title !== undefined ? { title: body.data.title } : {}),
    ...(body.data.rigidity !== undefined ? { rigidity: body.data.rigidity } : {}),
    ...(body.data.dueTime !== undefined ? { dueTime: body.data.dueTime } : {}),
    ...(body.data.recurrence !== undefined ? { recurrence: body.data.recurrence } : {}),
    ...(body.data.sortOrder !== undefined ? { sortOrder: body.data.sortOrder } : {}),
    ...(body.data.dueDate !== undefined ? { dueDate: body.data.dueDate ? new Date(`${body.data.dueDate}T00:00:00`) : null } : {}),
    ...(body.data.isDone !== undefined ? { isDone: body.data.isDone, doneAt: body.data.isDone ? new Date() : null } : {})
  };

  const task = await prisma.$transaction(async (tx) => {
    const updatedTask = await tx.task.update({
      where: { id },
      data
    });

    if (validatedPersonIds) {
      await tx.taskPerson.deleteMany({ where: { taskId: id } });
      if (validatedPersonIds.length > 0) {
        await tx.taskPerson.createMany({
          data: validatedPersonIds.map((familyMemberId) => ({ taskId: id, familyMemberId }))
        });
      }
    }

    return tx.task.findUniqueOrThrow({ where: { id: updatedTask.id }, include: { persons: true } });
  });

  revalidateTaskViews();

  return NextResponse.json({ task });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return apiError("UNAUTHORIZED", "Admin session required", 401);

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError("VALIDATION_ERROR", "Invalid task id", 400, parsedParams.error.flatten());
  const { id } = parsedParams.data;
  const existing = await prisma.task.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return apiError("NOT_FOUND", "Task not found", 404);

  await prisma.task.delete({ where: { id } });
  revalidateTaskViews();

  return NextResponse.json({ ok: true });
}
