import { redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { isAdminAuthenticated } from "@/server/auth/adminSession";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { TaskAdminEditor } from "@/components/admin/TaskAdminEditor";
import { parseTaskRecurrence } from "@/domain/tasks/recurrence";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin");

  const [tasks, familyMembers] = await Promise.all([
    prisma.task.findMany({ include: { persons: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.familyMember.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }] })
  ]);

  const activeFamilyMemberIds = new Set(familyMembers.map((member) => member.id));

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6">
        <AdminBackLink />
      </div>
      <h1 className="mb-6 text-4xl font-black">Aufgaben</h1>
      <p className="mb-6 rounded-2xl bg-sky-50 p-4 text-sky-950">
        Lege lokale Aufgaben an, ordne sie aktiven Familienmitgliedern zu und bearbeite Fälligkeit, Sortierung und Erledigt-Status. Änderungen werden für das Dashboard revalidiert.
      </p>
      <TaskAdminEditor
        tasks={tasks.map((task) => ({
          id: task.id,
          title: task.title,
          dueDate: task.dueDate?.toISOString() ?? null,
          dueTime: task.dueTime,
          rigidity: task.rigidity,
          recurrence: parseTaskRecurrence(task.recurrence),
          sortOrder: task.sortOrder,
          isDone: task.isDone,
          persons: task.persons
            .filter((person) => activeFamilyMemberIds.has(person.familyMemberId))
            .map((person) => ({ familyMemberId: person.familyMemberId }))
        }))}
        familyMembers={familyMembers.map((member) => ({
          id: member.id,
          displayName: member.displayName,
          shortName: member.shortName,
          color: member.color,
          icon: member.icon
        }))}
      />
    </main>
  );
}
