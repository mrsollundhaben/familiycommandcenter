"use client";

import { useState } from "react";

type SyncLogCounters = {
  eventsFetched: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
};

type SyncLogError = {
  code?: string;
  message?: string;
};

export type AdminSyncLog = SyncLogCounters & {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  message: string | null;
  errors: unknown;
};

type SyncButtonProps = {
  initialLogs: AdminSyncLog[];
};

type SyncStatusResponse = {
  logs: AdminSyncLog[];
};

type SyncRunResponse = {
  syncLog: AdminSyncLog;
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
  message?: string;
};

const privateDetailPattern = /https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[\w.-]+|"[^"]*"|'[^']*'|\[[^\]]*\]|\([^)]*\)/g;

function asErrorList(errors: unknown): SyncLogError[] {
  if (!Array.isArray(errors)) return [];
  return errors.filter((error): error is SyncLogError => typeof error === "object" && error !== null);
}

function sanitizeErrorMessage(error: SyncLogError) {
  const code = typeof error.code === "string" && error.code.trim() ? error.code.trim() : "SYNC_ERROR";
  const rawMessage = typeof error.message === "string" && error.message.trim() ? error.message.trim() : "Sync-Fehler";
  const redactedMessage = rawMessage
    .replace(privateDetailPattern, "[entfernt]")
    .replace(/\s+/g, " ");
  const sanitizedMessage = redactedMessage.slice(0, 140);
  const suffix = redactedMessage.length > 140 ? "…" : "";
  return `${code}: ${sanitizedMessage}${suffix}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function CounterGrid({ log }: { log: SyncLogCounters }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-4">
      <div className="rounded-2xl bg-slate-100 p-3">
        <dt className="text-sm font-semibold text-slate-500">Geladen</dt>
        <dd className="text-2xl font-black">{log.eventsFetched}</dd>
      </div>
      <div className="rounded-2xl bg-emerald-50 p-3">
        <dt className="text-sm font-semibold text-emerald-700">Erstellt</dt>
        <dd className="text-2xl font-black text-emerald-900">{log.eventsCreated}</dd>
      </div>
      <div className="rounded-2xl bg-sky-50 p-3">
        <dt className="text-sm font-semibold text-sky-700">Aktualisiert</dt>
        <dd className="text-2xl font-black text-sky-900">{log.eventsUpdated}</dd>
      </div>
      <div className="rounded-2xl bg-rose-50 p-3">
        <dt className="text-sm font-semibold text-rose-700">Gelöscht</dt>
        <dd className="text-2xl font-black text-rose-900">{log.eventsDeleted}</dd>
      </div>
    </dl>
  );
}

export function SyncButton({ initialLogs }: SyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [logs, setLogs] = useState(initialLogs);
  const [latestResult, setLatestResult] = useState<AdminSyncLog | null>(initialLogs[0] ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadStatus() {
    const response = await fetch("/api/admin/sync/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Sync-Status konnte nicht geladen werden.");
    const data = (await response.json()) as SyncStatusResponse;
    setLogs(data.logs);
    setLatestResult(data.logs[0] ?? null);
  }

  async function startSync() {
    setIsSyncing(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin/sync/icloud", { method: "POST" });
      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        throw new Error(errorBody?.error?.message ?? errorBody?.message ?? "iCloud-Sync konnte nicht gestartet werden.");
      }

      const data = (await response.json()) as SyncRunResponse;
      setLatestResult(data.syncLog);
      await loadStatus();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unbekannter Sync-Fehler.");
    } finally {
      setIsSyncing(false);
    }
  }

  const latestErrors = latestResult ? asErrorList(latestResult.errors) : [];

  return (
    <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sync-Status</h2>
          <p className="text-slate-600">Status: {latestResult?.status ?? "noch kein Sync"}</p>
          <p className="text-slate-600">Letzte Meldung: {latestResult?.message ?? "—"}</p>
          <p className="text-sm text-slate-500">Letzter Start: {formatDate(latestResult?.startedAt ?? null)}</p>
        </div>
        <button
          type="button"
          onClick={startSync}
          disabled={isSyncing}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-lg font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSyncing ? "Synchronisiere…" : "iCloud synchronisieren"}
        </button>
      </div>

      {latestResult ? <CounterGrid log={latestResult} /> : null}

      {errorMessage ? <p className="mt-4 rounded-2xl bg-rose-50 p-3 font-semibold text-rose-800">{errorMessage}</p> : null}

      {latestErrors.length > 0 ? (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-amber-950">
          <h3 className="font-black">Gekürzte Sync-Fehler</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {latestErrors.slice(0, 3).map((error, index) => (
              <li key={`${error.code ?? "sync-error"}-${index}`}>{sanitizeErrorMessage(error)}</li>
            ))}
          </ul>
          {latestErrors.length > 3 ? <p className="mt-2 text-sm">Weitere Fehler sind im Sync-Log vorhanden.</p> : null}
        </div>
      ) : null}

      {logs.length > 1 ? (
        <div className="mt-5">
          <h3 className="mb-2 font-bold">Letzte Syncs</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            {logs.slice(1, 5).map((log) => (
              <li key={log.id} className="flex flex-col rounded-2xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{formatDate(log.startedAt)} · {log.status}</span>
                <span>{log.eventsFetched} geladen · {log.eventsCreated} erstellt · {log.eventsUpdated} aktualisiert · {log.eventsDeleted} gelöscht</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
