import { redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { isAdminAuthenticated } from "@/server/auth/adminSession";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { FamilyMemberEditor } from "@/components/admin/FamilyMemberEditor";
import { buildFamilyMemberTagHelpRows } from "@/domain/events/icloudMapping";

export const dynamic = "force-dynamic";

export default async function FamilyMembersPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin");
  const members = await prisma.familyMember.findMany({ orderBy: { sortOrder: "asc" } });
  const tagHelpRows = buildFamilyMemberTagHelpRows(members);
  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6">
        <AdminBackLink />
      </div>
      <h1 className="mb-6 text-4xl font-black">Familienmitglieder</h1>
      <p className="mb-6 rounded-2xl bg-sky-50 p-4 text-sky-950">Bearbeite Namen, Farben, Icons und Sichtbarkeit. Bestehende Termin- und Aufgaben-Zuordnungen bleiben erhalten, weil die IDs unverändert bleiben.</p>
      <section className="mb-6 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm" aria-labelledby="family-member-tag-help">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="family-member-tag-help" className="text-2xl font-black text-slate-950">Tag-Hilfe für iCloud</h2>
            <p className="mt-2 max-w-3xl text-slate-700">
              Diese Tags kannst du in iCloud-Terminen im Titel oder in der Beschreibung verwenden.
              <span className="font-semibold"> displayName</span> ist dabei der sichtbare Name in Dashboard und Adminbereich; der Tag soll in iCloud stabil bleiben, auch wenn sichtbare Namen später geändert werden.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">Optional später: frei konfigurierbare Aliase</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">ShortName</th>
                <th className="px-4 py-3">Verwendbarer Tag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
              {tagHelpRows.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3 font-semibold">
                    {member.displayName}
                    {!member.isActive ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">inaktiv</span> : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{member.shortName}</td>
                  <td className="px-4 py-3">
                    {member.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {member.tags.map((tag) => (
                          <code key={tag} className="rounded-xl bg-slate-900 px-3 py-1 font-mono text-sm font-bold text-white">{tag}</code>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500">Kein Standard-Tag gefunden</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
          Wichtig: Bereits verwendete iCloud-Tags wie <code className="font-mono font-bold">[KIND1]</code>, <code className="font-mono font-bold">[MAMA]</code> oder <code className="font-mono font-bold">[PAPA]</code> nicht leichtfertig umbenennen.
          So bleiben bestehende Termine beim Sync zuverlässig derselben Person zugeordnet. Für alle Personen gemeinsam kann <code className="font-mono font-bold">[ALLE]</code> verwendet werden.
        </p>
      </section>
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
