"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { RefreshCw } from "lucide-react";
import { EventCard } from "@/components/dashboard/EventCard";
import { FamilyMemberBar } from "@/components/dashboard/FamilyMemberBar";
import { findCurrent, findNext, minutesUntil } from "@/domain/events/grouping";
import type { DashboardItem, DashboardToday } from "@/domain/events/types";

const DASHBOARD_REFRESH_MS = 45_000;
const CLOCK_REFRESH_MS = 1_000;

function currentTime() {
  return new Date();
}

async function fetchDashboardToday(signal?: AbortSignal) {
  const response = await fetch("/api/dashboard/today", {
    cache: "no-store",
    signal
  });

  if (!response.ok) {
    throw new Error(`Dashboard konnte nicht aktualisiert werden (${response.status})`);
  }

  return response.json() as Promise<DashboardToday>;
}

function SyncNotice({ data, lastUpdatedAt, error }: { data: DashboardToday | null; lastUpdatedAt: Date | null; error: string | null }) {
  if (!data && !error) {
    return <p className="text-sm text-slate-500">Lade Dashboard…</p>;
  }

  return (
    <div className="flex flex-col items-end gap-1 text-sm text-slate-500">
      <p>Sync: {data?.sync.status ?? "noch nie"}</p>
      {lastUpdatedAt ? <p>Aktualisiert: {format(lastUpdatedAt, "HH:mm:ss", { locale: de })}</p> : null}
      {error ? (
        <p className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900">
          <RefreshCw className="h-4 w-4" /> Nutze alte Daten · {error}
        </p>
      ) : null}
      {data?.sync.isStale ? <p className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">Server-Sync ist älter als 30 Min.</p> : null}
    </div>
  );
}

function DashboardLoading() {
  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <section className="rounded-[2rem] bg-white p-8 shadow-sm">
        <p className="text-4xl font-black">Dashboard wird geladen…</p>
        <p className="mt-3 text-xl text-slate-600">Die Live-Daten werden gerade synchronisiert.</p>
      </section>
    </main>
  );
}

function DashboardError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <section className="rounded-[2rem] bg-white p-8 shadow-sm">
        <p className="text-4xl font-black">Dashboard ist gerade nicht erreichbar.</p>
        <p className="mt-3 text-xl text-slate-600">{error}</p>
        <button type="button" onClick={onRetry} className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-2xl font-black text-white">
          Erneut laden
        </button>
      </section>
    </main>
  );
}

function nextWithCountdown(item: DashboardItem | null, now: Date) {
  return item?.startDateTime ? { ...item, countdownMinutes: minutesUntil(item.startDateTime, now) } : null;
}

export function LiveDashboard({ syncDaysAhead }: { syncDaysAhead: number }) {
  const [data, setData] = useState<DashboardToday | null>(null);
  const [now, setNow] = useState(currentTime);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const dashboard = await fetchDashboardToday(signal);
      setData(dashboard);
      setNow(currentTime());
      setLastUpdatedAt(currentTime());
      setError(null);
    } catch (refreshError) {
      if (refreshError instanceof DOMException && refreshError.name === "AbortError") return;
      setError(refreshError instanceof Error ? refreshError.message : "Unbekannter Refresh-Fehler");
    } finally {
      setIsInitialLoadDone(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);

    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(currentTime()), CLOCK_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), DASHBOARD_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const liveItems = useMemo(() => data?.sections.later ?? [], [data]);
  const current = useMemo(() => findCurrent(liveItems, now), [liveItems, now]);
  const next = useMemo(() => nextWithCountdown(findNext(liveItems, now), now), [liveItems, now]);
  const allItems = useMemo(() => (data ? [...data.sections.allDay, ...data.sections.later, ...data.sections.tasks] : []), [data]);

  if (!data && !isInitialLoadDone) {
    return <DashboardLoading />;
  }

  if (!data && error) {
    return <DashboardError error={error} onRetry={() => void refresh()} />;
  }

  if (!data) return null;

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <header className="mb-6 rounded-[2rem] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-3xl font-black capitalize">{format(now, "EEEE, d. MMMM", { locale: de })}</p>
            <p className="text-xl text-slate-600">Heute und die nächsten {syncDaysAhead} Tage im Blick</p>
          </div>
          <div className="text-right">
            <p className="text-6xl font-black tabular-nums">{format(now, "HH:mm")}</p>
            <SyncNotice data={data} lastUpdatedAt={lastUpdatedAt} error={error} />
          </div>
        </div>
      </header>

      <section className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-3xl font-black">Jetzt</h2>
          {current ? <EventCard item={current} people={data.familyMembers} /> : <div className="rounded-3xl bg-sky-50 p-8 text-5xl font-black text-sky-950">Gerade frei 🧘</div>}
        </div>
        <div className="rounded-[2rem] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-3xl font-black">Als Nächstes</h2>
          {next ? (
            <div className="grid gap-4">
              <div className="rounded-3xl bg-indigo-50 p-5 text-3xl font-black text-indigo-950">Noch {next.countdownMinutes} Minuten</div>
              <EventCard item={next} people={data.familyMembers} />
            </div>
          ) : (
            <div className="rounded-3xl bg-emerald-50 p-8 text-5xl font-black text-emerald-950">Heute nichts Fixes mehr 🎉</div>
          )}
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
