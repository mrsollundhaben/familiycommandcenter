"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CheckCircle2, Package, RefreshCw } from "lucide-react";
import { SyncStatusBadge } from "@/components/dashboard/SyncStatusBadge";
import { EventCard } from "@/components/dashboard/EventCard";
import { FamilyMemberBar } from "@/components/dashboard/FamilyMemberBar";
import { findCurrent, findNext, minutesUntil } from "@/domain/events/grouping";
import type { DashboardDaySection, DashboardItem, DashboardToday } from "@/domain/events/types";

const DASHBOARD_REFRESH_MS = 15_000;
const DASHBOARD_SYNC_RUNNING_REFRESH_MS = 3_000;
const CLOCK_REFRESH_MS = 1_000;

function currentTime() {
  return new Date();
}

async function fetchDashboardToday(signal?: AbortSignal) {
  const response = await fetch(`/api/dashboard/today?ts=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
    signal
  });

  if (!response.ok) {
    throw new Error(`Dashboard konnte nicht aktualisiert werden (${response.status})`);
  }

  return response.json() as Promise<DashboardToday>;
}

function SyncNotice({ data, lastUpdatedAt, error, now }: { data: DashboardToday | null; lastUpdatedAt: Date | null; error: string | null; now: Date }) {
  if (!data && !error) {
    return <p className="text-sm text-slate-500">Lade Dashboard…</p>;
  }

  return (
    <div className="flex flex-col items-end gap-1 text-sm text-slate-500">
      {data ? <SyncStatusBadge sync={data.sync} now={now} /> : null}
      {lastUpdatedAt ? <p>Dashboard aktualisiert: {format(lastUpdatedAt, "HH:mm:ss", { locale: de })}</p> : null}
      {error ? (
        <p className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900">
          <RefreshCw className="h-4 w-4" /> Nutze alte Daten · {error}
        </p>
      ) : null}
    </div>
  );
}

function DayItemsSection({ day, people, onDoneChanged }: { day: DashboardDaySection; people: DashboardToday["familyMembers"]; onDoneChanged: (isDone: boolean, taskId: string) => Promise<void> | void }) {
  const date = new Date(`${day.date}T12:00:00`);
  const isToday = day.dayOffset === 0;

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-4xl font-black">{day.label}</h2>
          <p className="text-xl font-semibold capitalize text-slate-500">{format(date, "EEEE, d. MMMM", { locale: de })}</p>
        </div>
        {day.isLimited ? <p className="rounded-full bg-slate-100 px-4 py-2 text-lg font-bold text-slate-600">Fixe & wichtige Termine</p> : null}
      </div>

      {day.items.length ? (
        <div className="grid gap-4">
          {day.items.map((item) => <EventCard key={`${day.date}-${item.kind}-${item.id}`} item={item} people={people} onDoneChanged={onDoneChanged} />)}
        </div>
      ) : (
        <p className="rounded-3xl bg-slate-50 p-6 text-3xl font-black text-slate-500">{isToday ? "Heute nichts mehr geplant." : "Keine fixen oder wichtigen Termine."}</p>
      )}

      {day.hiddenItemCount > 0 ? (
        <p className="mt-4 rounded-3xl bg-slate-50 p-4 text-xl font-bold text-slate-600">
          {day.hiddenItemCount} weitere {day.hiddenItemCount === 1 ? "Eintrag" : "Einträge"} ausgeblendet, damit das Dashboard übersichtlich bleibt.
        </p>
      ) : null}
    </section>
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

function livePreparationChecklist(item: DashboardItem, now: Date) {
  if (!item.preparationChecklist?.length) return [];
  return item.preparationChecklist.map((hint) => {
    if (!item.leaveAt || !hint.startsWith("Losgehen")) return hint;
    return `Losgehen in ${minutesUntil(item.leaveAt, now)} Minuten`;
  });
}

function NextPreparationHints({ item, now }: { item: DashboardItem; now: Date }) {
  const checklist = livePreparationChecklist(item, now);
  if (checklist.length === 0) return null;

  return (
    <div className="rounded-3xl border-4 border-violet-200 bg-violet-50 p-5 text-violet-950">
      <div className="mb-3 flex items-center gap-3 text-3xl font-black">
        <Package className="h-8 w-8" />
        <span>Vorbereitung</span>
      </div>
      <ul className="grid gap-2 text-2xl font-black">
        {checklist.map((hint) => (
          <li key={hint} className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3">
            <CheckCircle2 className="h-7 w-7 shrink-0" />
            <span>{hint}</span>
          </li>
        ))}
      </ul>
    </div>
  );
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
    const refreshMs = data?.sync.status === "running" ? DASHBOARD_SYNC_RUNNING_REFRESH_MS : DASHBOARD_REFRESH_MS;
    const timer = window.setInterval(() => void refresh(), refreshMs);
    return () => window.clearInterval(timer);
  }, [data?.sync.status, refresh]);

  useEffect(() => {
    const refreshVisibleDashboard = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    document.addEventListener("visibilitychange", refreshVisibleDashboard);
    window.addEventListener("focus", refreshVisibleDashboard);

    return () => {
      document.removeEventListener("visibilitychange", refreshVisibleDashboard);
      window.removeEventListener("focus", refreshVisibleDashboard);
    };
  }, [refresh]);

  useEffect(() => {
    const refreshAfterFamilyMemberUpdate = () => void refresh();
    const refreshAfterStorageUpdate = (event: StorageEvent) => {
      if (event.key === "family-members-updated") void refresh();
    };
    const channel = "BroadcastChannel" in window ? new BroadcastChannel("family-command-center") : null;

    channel?.addEventListener("message", refreshAfterFamilyMemberUpdate);
    window.addEventListener("storage", refreshAfterStorageUpdate);

    return () => {
      channel?.removeEventListener("message", refreshAfterFamilyMemberUpdate);
      channel?.close();
      window.removeEventListener("storage", refreshAfterStorageUpdate);
    };
  }, [refresh]);

  const todayEvents = useMemo(() => data?.sections.days[0]?.items.filter((item) => item.kind === "event") ?? [], [data]);
  const current = useMemo(() => findCurrent(todayEvents, now), [todayEvents, now]);
  const next = useMemo(() => nextWithCountdown(data?.next ?? findNext(todayEvents, now), now), [data?.next, todayEvents, now]);
  const allItems = useMemo(() => data?.sections.days.flatMap((day) => day.items) ?? [], [data]);
  const refetchDashboardAfterTaskDone = useCallback(async () => {
    await refresh();
  }, [refresh]);

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
            <SyncNotice data={data} lastUpdatedAt={lastUpdatedAt} error={error} now={now} />
          </div>
        </div>
      </header>

      <section className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-[2rem] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-3xl font-black">Jetzt</h2>
          {current ? <EventCard item={current} people={data.familyMembers} onDoneChanged={refetchDashboardAfterTaskDone} /> : <div className="rounded-3xl bg-sky-50 p-8 text-5xl font-black text-sky-950">Gerade frei 🧘</div>}
        </div>
        <div className="rounded-[2rem] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-3xl font-black">Als Nächstes</h2>
          {next ? (
            <div className="grid gap-4">
              <div className="rounded-3xl bg-indigo-50 p-5 text-3xl font-black text-indigo-950">Noch {next.countdownMinutes} Minuten</div>
              <NextPreparationHints item={next} now={now} />
              <EventCard item={next} people={data.familyMembers} onDoneChanged={refetchDashboardAfterTaskDone} />
            </div>
          ) : (
            <div className="rounded-3xl bg-emerald-50 p-8 text-5xl font-black text-emerald-950">Heute nichts Fixes mehr 🎉</div>
          )}
        </div>
      </section>

      <div className="mb-6 grid gap-6">
        {data.sections.days.map((day) => (
          <DayItemsSection key={day.date} day={day} people={data.familyMembers} onDoneChanged={refetchDashboardAfterTaskDone} />
        ))}
      </div>

      <FamilyMemberBar people={data.familyMembers} items={allItems} />
    </main>
  );
}
