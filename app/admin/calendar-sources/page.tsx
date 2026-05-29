import { redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { isAdminAuthenticated } from "@/server/auth/adminSession";

export const dynamic = "force-dynamic";

export default async function CalendarSourcesPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin");
  const sources = await prisma.calendarSource.findMany({ orderBy: { name: "asc" } });
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-4xl font-black">Kalenderquellen</h1>
      <p className="mb-6 rounded-2xl bg-amber-50 p-4 text-amber-950">iCloud-Kalender werden in Version 1 read-only synchronisiert. Zugangsdaten kommen ausschließlich aus Environment Variables.</p>
      <div className="grid gap-4">
        {sources.length ? sources.map((source) => (
          <article key={source.id} className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black">{source.name}</h2>
            <p>Kalender: {source.calendarName}</p>
            <p>Default: {source.defaultRigidity} / {source.defaultCategory}</p>
            <p>Status: {source.lastSyncStatus ?? "—"}</p>
          </article>
        )) : <p className="rounded-3xl bg-white p-6 text-xl">Noch keine Kalenderquellen vorhanden.</p>}
      </div>
    </main>
  );
}
