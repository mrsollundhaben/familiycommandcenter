import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/prisma";
import { isAdminAuthenticated } from "@/server/auth/adminSession";
import { apiError } from "@/lib/errors";

const schema = z.object({
  displayName: z.string().min(1).optional(),
  shortName: z.string().min(1).optional(),
  role: z.enum(["parent", "child"]).optional(),
  color: z.string().min(1).optional(),
  icon: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional()
}).strict().refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return apiError("UNAUTHORIZED", "Admin session required", 401);

  const { id } = await params;
  const body = schema.safeParse(await request.json());
  if (!body.success) return apiError("VALIDATION_ERROR", "Invalid family member update", 400, body.error.flatten());

  const existing = await prisma.familyMember.findUnique({ where: { id } });
  if (!existing) return apiError("NOT_FOUND", "Family member not found", 404);

  const familyMember = await prisma.familyMember.update({
    where: { id },
    data: body.data
  });

  revalidatePath("/admin/family-members");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/today");

  return NextResponse.json({ familyMember });
}
