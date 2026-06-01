import { redirect } from "next/navigation";
import { CalendarSourceEditor } from "@/components/admin/CalendarSourceEditor";
import { prisma } from "@/server/db/prisma";
import { isAdminAuthenticated } from "@/server/auth/adminSession";

export const dynamic = "force-dynamic";

function jsonStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default async function CalendarSourcesPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin");
  const [sources, familyMembers] = await Promise.all([
    prisma.calendarSource.findMany({ orderBy: { name: "asc" } }),
    prisma.familyMember.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }] })
  ]);
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-4xl font-black">Kalenderquellen</h1>
      <p className="mb-6 rounded-2xl bg-amber-50 p-4 text-amber-950">iCloud-Kalender werden read-only synchronisiert. Zugangsdaten kommen ausschließlich aus Environment Variables und werden hier nicht gespeichert.</p>
      <CalendarSourceEditor
        sources={sources.map((source) => ({
          id: source.id,
          name: source.name,
          calendarName: source.calendarName,
          calendarColor: source.calendarColor,
          enabled: source.enabled,
          defaultRigidity: source.defaultRigidity,
          defaultCategory: source.defaultCategory,
          defaultPersonIds: jsonStringArray(source.defaultPersonIds),
          includeInDashboard: source.includeInDashboard,
          lastSyncStatus: source.lastSyncStatus,
          lastSyncAt: source.lastSyncAt?.toISOString() ?? null
        }))}
        familyMembers={familyMembers.map((member) => ({
          id: member.id,
          displayName: member.displayName,
          shortName: member.shortName,
          color: member.color
        }))}
      />
    </main>
  );
}
