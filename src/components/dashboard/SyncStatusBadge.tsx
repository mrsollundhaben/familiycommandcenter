import { AlertTriangle, CheckCircle2, RefreshCw, type LucideIcon } from "lucide-react";
import type { DashboardToday } from "@/domain/events/types";

type SyncStatus = DashboardToday["sync"];

type BadgeTone = "green" | "yellow" | "red" | "blue";

const toneStyles: Record<BadgeTone, string> = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  yellow: "bg-amber-50 text-amber-900 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200"
};

function minutesSince(lastSyncAt: string | null, now: Date) {
  if (!lastSyncAt) return null;

  const parsedLastSyncAt = new Date(lastSyncAt);
  if (Number.isNaN(parsedLastSyncAt.getTime())) return null;

  return Math.max(0, Math.floor((now.getTime() - parsedLastSyncAt.getTime()) / 60_000));
}

function staleLabel(lastSyncAt: string | null, now: Date) {
  const minutes = minutesSince(lastSyncAt, now);
  if (minutes === null) return "Noch nicht aktualisiert";
  if (minutes === 0) return "Seit weniger als 1 Minute nicht aktualisiert";
  return `Seit ${minutes} ${minutes === 1 ? "Minute" : "Minuten"} nicht aktualisiert`;
}

function getBadgeContent(sync: SyncStatus, now: Date): { tone: BadgeTone; label: string; hint?: string; icon: LucideIcon } {
  if (sync.status === "failed") {
    return { tone: "red", label: "Kalender-Sync fehlgeschlagen", hint: "Kalender prüfen", icon: AlertTriangle };
  }

  if (sync.status === "partial") {
    return {
      tone: "yellow",
      label: sync.isStale ? staleLabel(sync.lastSyncAt, now) : "Teilweise aktualisiert",
      hint: "Kalender prüfen",
      icon: AlertTriangle
    };
  }

  if (sync.isStale) {
    return { tone: "yellow", label: staleLabel(sync.lastSyncAt, now), icon: AlertTriangle };
  }

  if (sync.status === "running") {
    return { tone: "blue", label: "Sync läuft", icon: RefreshCw };
  }

  return { tone: "green", label: "Aktuell", icon: CheckCircle2 };
}

export function SyncStatusBadge({ sync, now }: { sync: SyncStatus; now: Date }) {
  const badge = getBadgeContent(sync, now);
  const Icon = badge.icon;

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${toneStyles[badge.tone]}`} aria-live="polite">
      <Icon className={`h-4 w-4 ${sync.status === "running" ? "animate-spin" : ""}`} aria-hidden="true" />
      <span>{badge.label}</span>
      {badge.hint ? <span className="border-l border-current/25 pl-2 text-xs font-bold uppercase tracking-wide opacity-80">{badge.hint}</span> : null}
    </div>
  );
}
