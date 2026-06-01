import { redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { isAdminAuthenticated } from "@/server/auth/adminSession";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { FamilyMemberEditor } from "@/components/admin/FamilyMemberEditor";

export const dynamic = "force-dynamic";

export default async function FamilyMembersPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin");
  const members = await prisma.familyMember.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6">
        <AdminBackLink />
      </div>
      <h1 className="mb-6 text-4xl font-black">Familienmitglieder</h1>
      <p className="mb-6 rounded-2xl bg-sky-50 p-4 text-sky-950">Bearbeite Namen, Farben, Icons und Sichtbarkeit. Bestehende Termin- und Aufgaben-Zuordnungen bleiben erhalten, weil die IDs unverändert bleiben.</p>
      <FamilyMemberEditor
        members={members.map((member) => ({
          id: member.id,
          displayName: member.displayName,
          shortName: member.shortName,
          role: member.role,
          color: member.color,
          icon: member.icon,
          sortOrder: member.sortOrder,
          isActive: member.isActive
        }))}
      />
    </main>
  );
}
