import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { apiError } from "@/lib/errors";

const schema = z.object({
  isDone: z.boolean(),
  date: z.string().date().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = schema.safeParse(await request.json());
  if (!body.success) return apiError("VALIDATION_ERROR", "Invalid task done payload", 400, body.error.flatten());
  const { id } = await context.params;

  if (body.data.date) {
    const task = await prisma.task.findUnique({ where: { id }, select: { id: true } });
    if (!task) return apiError("NOT_FOUND", "Task not found", 404);

    const completion = await prisma.taskCompletion.upsert({
      where: { taskId_date: { taskId: id, date: body.data.date } },
      create: {
        taskId: id,
        date: body.data.date,
        isDone: body.data.isDone,
        doneAt: body.data.isDone ? new Date() : null
      },
      update: {
        isDone: body.data.isDone,
        doneAt: body.data.isDone ? new Date() : null
      }
    });

    return NextResponse.json({ taskCompletion: completion });
  }

  const task = await prisma.task.update({
    where: { id },
    data: { isDone: body.data.isDone, doneAt: body.data.isDone ? new Date() : null }
  });
  return NextResponse.json({ task });
}
