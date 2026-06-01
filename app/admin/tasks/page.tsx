import { redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { isAdminAuthenticated } from "@/server/auth/adminSession";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin");
  const tasks = await prisma.task.findMany({ include: { persons: true }, orderBy: { sortOrder: "asc" } });
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-4xl font-black">Aufgaben</h1>
      <div className="grid gap-4">
        {tasks.length ? tasks.map((task) => (
          <article key={task.id} className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black">{task.isDone ? "✅" : "⬜"} {task.title}</h2>
            <p>Rigidity: {task.rigidity}</p>
          </article>
        )) : <p className="rounded-3xl bg-white p-6 text-xl">Noch keine lokalen Aufgaben vorhanden.</p>}
      </div>
    </main>
  );
}
