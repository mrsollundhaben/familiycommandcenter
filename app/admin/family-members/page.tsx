import { redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { isAdminAuthenticated } from "@/server/auth/adminSession";
import { AdminBackLink } from "@/components/admin/AdminBackLink";

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
      <div className="grid gap-4">
        {members.map((member) => (
          <article key={member.id} className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4 text-2xl font-black">
              <span className="rounded-full px-4 py-2 text-white" style={{ backgroundColor: member.color }}>{member.icon} {member.shortName}</span>
              <span>{member.displayName}</span>
              <span className="text-base text-slate-500">{member.role}</span>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
