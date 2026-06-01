import Link from "next/link";
import { isAdminAuthenticated } from "@/server/auth/adminSession";
import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authed = await isAdminAuthenticated();
  const lastSync = authed ? await prisma.syncLog.findFirst({ orderBy: { startedAt: "desc" } }) : null;

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <form action="/api/admin/login" method="post" className="rounded-3xl bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-3xl font-black">Admin-PIN</h1>
          <p className="mb-4 text-slate-600">Für die erste Iteration steht zusätzlich der JSON-Endpunkt bereit: POST /api/admin/login.</p>
          <input name="pin" type="password" className="mb-4 w-full rounded-xl border p-3 text-xl" placeholder="PIN" />
          <button className="w-full rounded-xl bg-slate-950 p-3 text-xl font-bold text-white">Einloggen</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-4xl font-black">Family Command Center Admin</h1>
      <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold">Sync-Status</h2>
        <p>Status: {lastSync?.status ?? "noch kein Sync"}</p>
        <p>Letzte Meldung: {lastSync?.message ?? "—"}</p>
      </div>
      <nav className="grid gap-4 md:grid-cols-3">
        <Link className="rounded-3xl bg-white p-6 text-2xl font-black shadow-sm" href="/admin/family-members">Familie</Link>
        <Link className="rounded-3xl bg-white p-6 text-2xl font-black shadow-sm" href="/admin/calendar-sources">Kalender</Link>
        <Link className="rounded-3xl bg-white p-6 text-2xl font-black shadow-sm" href="/admin/tasks">Aufgaben</Link>
      </nav>
    </main>
  );
}
