import { format } from "date-fns";
import { de } from "date-fns/locale";
import { getDashboardToday } from "@/server/services/getDashboardToday";
import { EventCard } from "@/components/dashboard/EventCard";
import { FamilyMemberBar } from "@/components/dashboard/FamilyMemberBar";

export const dynamic = "force-dynamic";

export default async function DashboardTodayPage() {
  const data = await getDashboardToday();
  const allItems = [...data.sections.allDay, ...data.sections.later, ...data.sections.tasks];

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <header className="mb-6 rounded-[2rem] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-3xl font-black capitalize">{format(new Date(data.now), "EEEE, d. MMMM", { locale: de })}</p>
            <p className="text-xl text-slate-600">Heute und die nächsten {process.env.SYNC_DAYS_AHEAD ?? 3} Tage im Blick</p>
          </div>
          <div className="text-right">
            <p className="text-6xl font-black tabular-nums">{format(new Date(data.now), "HH:mm")}</p>
            <p className="text-sm text-slate-500">Sync: {data.sync.status ?? "noch nie"}</p>
          </div>
        </div>
      </header>

      <section className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-3xl font-black">Jetzt</h2>
          {data.current ? <EventCard item={data.current} people={data.familyMembers} /> : <div className="rounded-3xl bg-sky-50 p-8 text-5xl font-black text-sky-950">Gerade frei 🧘</div>}
        </div>
        <div className="rounded-[2rem] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-3xl font-black">Als Nächstes</h2>
          {data.next ? (
            <div className="grid gap-4">
              <div className="rounded-3xl bg-indigo-50 p-5 text-3xl font-black text-indigo-950">Noch {data.next.countdownMinutes} Minuten</div>
              <EventCard item={data.next} people={data.familyMembers} />
            </div>
          ) : <div className="rounded-3xl bg-emerald-50 p-8 text-5xl font-black text-emerald-950">Heute nichts Fixes mehr 🎉</div>}
        </div>
      </section>

      <section className="mb-6 grid gap-4">
        <h2 className="text-4xl font-black">Tagesliste</h2>
        {data.sections.allDay.map((item) => <EventCard key={item.id} item={item} people={data.familyMembers} />)}
        {data.sections.later.map((item) => <EventCard key={item.id} item={item} people={data.familyMembers} />)}
      </section>

      <section className="mb-6 grid gap-4">
        <h2 className="text-4xl font-black">Aufgaben</h2>
        {data.sections.tasks.length ? data.sections.tasks.map((item) => <EventCard key={item.id} item={item} people={data.familyMembers} />) : <p className="rounded-3xl bg-white p-6 text-3xl font-black">Keine offenen Aufgaben.</p>}
      </section>

      <FamilyMemberBar people={data.familyMembers} items={allItems} />
    </main>
  );
}
