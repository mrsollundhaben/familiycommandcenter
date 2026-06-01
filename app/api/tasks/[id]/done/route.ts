import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { apiError } from "@/lib/errors";

const schema = z.object({ isDone: z.boolean() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = schema.safeParse(await request.json());
  if (!body.success) return apiError("VALIDATION_ERROR", "Invalid task done payload", 400, body.error.flatten());
  const { id } = await context.params;
  const task = await prisma.task.update({
    where: { id },
    data: { isDone: body.data.isDone, doneAt: body.data.isDone ? new Date() : null }
  });
  return NextResponse.json({ task });
}
