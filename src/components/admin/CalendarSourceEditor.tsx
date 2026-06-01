"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { EventCategory, Rigidity } from "@/domain/events/valueTypes";

type CalendarSourceEditorSource = {
  id: string;
  name: string;
  calendarName: string;
  calendarColor: string | null;
  enabled: boolean;
  defaultRigidity: string;
  defaultCategory: string;
  defaultPersonIds: string[];
  includeInDashboard: boolean;
  lastSyncStatus: string | null;
  lastSyncAt: string | null;
};

type CalendarSourceEditorMember = {
  id: string;
  displayName: string;
  shortName: string;
  color: string;
};

type SourceFormState = Pick<CalendarSourceEditorSource, "enabled" | "includeInDashboard" | "defaultRigidity" | "defaultCategory" | "defaultPersonIds">;

type SaveState = "idle" | "saving" | "saved" | "error";

const rigidityOptions: Array<{ value: Rigidity; label: string }> = [
  { value: "flexible", label: "Flexibel" },
  { value: "fixed", label: "Fix" },
  { value: "optional", label: "Optional" }
];

const categoryOptions: Array<{ value: EventCategory; label: string }> = [
  { value: "appointment", label: "Termin" },
  { value: "task", label: "Aufgabe" },
  { value: "routine", label: "Routine" },
  { value: "reminder", label: "Erinnerung" }
];

function toInitialFormState(source: CalendarSourceEditorSource): SourceFormState {
  return {
    enabled: source.enabled,
    includeInDashboard: source.includeInDashboard,
    defaultRigidity: source.defaultRigidity,
    defaultCategory: source.defaultCategory,
    defaultPersonIds: source.defaultPersonIds
  };
}

function uniquePersonIds(personIds: string[]) {
  return [...new Set(personIds)];
}

export function CalendarSourceEditor({ sources, familyMembers }: { sources: CalendarSourceEditorSource[]; familyMembers: CalendarSourceEditorMember[] }) {
  const [formStates, setFormStates] = useState<Record<string, SourceFormState>>(() => Object.fromEntries(sources.map((source) => [source.id, toInitialFormState(source)])));
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const activeMemberIds = useMemo(() => new Set(familyMembers.map((member) => member.id)), [familyMembers]);

  function updateSource(id: string, update: Partial<SourceFormState>) {
    setFormStates((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...update
      }
    }));
    setSaveStates((current) => ({ ...current, [id]: "idle" }));
    setErrors((current) => ({ ...current, [id]: "" }));
  }

  function togglePerson(sourceId: string, memberId: string) {
    const currentPersonIds = formStates[sourceId]?.defaultPersonIds ?? [];
    const nextPersonIds = currentPersonIds.includes(memberId)
      ? currentPersonIds.filter((id) => id !== memberId)
      : uniquePersonIds([...currentPersonIds, memberId]);
    updateSource(sourceId, { defaultPersonIds: nextPersonIds.filter((id) => activeMemberIds.has(id)) });
  }

  async function saveSource(event: FormEvent<HTMLFormElement>, sourceId: string) {
    event.preventDefault();
    const formState = formStates[sourceId];
    if (!formState) return;

    setSaveStates((current) => ({ ...current, [sourceId]: "saving" }));
    setErrors((current) => ({ ...current, [sourceId]: "" }));

    const response = await fetch(`/api/admin/calendar-sources/${encodeURIComponent(sourceId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: formState.enabled,
        includeInDashboard: formState.includeInDashboard,
        defaultRigidity: formState.defaultRigidity,
        defaultCategory: formState.defaultCategory,
        defaultPersonIds: formState.defaultPersonIds
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      setSaveStates((current) => ({ ...current, [sourceId]: "error" }));
      setErrors((current) => ({ ...current, [sourceId]: payload?.error?.message ?? "Speichern fehlgeschlagen." }));
      return;
    }

    const payload = await response.json() as { calendarSource: CalendarSourceEditorSource };
    setFormStates((current) => ({ ...current, [sourceId]: toInitialFormState(payload.calendarSource) }));
    setSaveStates((current) => ({ ...current, [sourceId]: "saved" }));
  }

  if (sources.length === 0) {
    return <p className="rounded-3xl bg-white p-6 text-xl">Noch keine Kalenderquellen vorhanden.</p>;
  }

  return (
    <div className="grid gap-4">
      {sources.map((source) => {
        const formState = formStates[source.id] ?? toInitialFormState(source);
        const saveState = saveStates[source.id] ?? "idle";
        const error = errors[source.id];

        return (
          <form key={source.id} onSubmit={(event) => void saveSource(event, source.id)} className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  {source.calendarColor ? <span className="h-4 w-4 rounded-full" style={{ backgroundColor: source.calendarColor }} aria-hidden="true" /> : null}
                  <h2 className="text-2xl font-black">{source.name}</h2>
                </div>
                <p className="text-slate-600">Kalender: {source.calendarName}</p>
                <p className="text-sm text-slate-500">Status: {source.lastSyncStatus ?? "—"}{source.lastSyncAt ? ` · letzter Sync: ${new Date(source.lastSyncAt).toLocaleString("de-AT")}` : ""}</p>
              </div>
              <button type="submit" disabled={saveState === "saving"} className="rounded-full bg-slate-950 px-5 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">
                {saveState === "saving" ? "Speichern…" : "Speichern"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-bold">
                <input type="checkbox" checked={formState.enabled} onChange={(event) => updateSource(source.id, { enabled: event.target.checked })} className="h-5 w-5" />
                Synchronisierung aktiv
              </label>
              <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-bold">
                <input type="checkbox" checked={formState.includeInDashboard} onChange={(event) => updateSource(source.id, { includeInDashboard: event.target.checked })} className="h-5 w-5" />
                Im Dashboard anzeigen
              </label>

              <label className="grid gap-2 font-bold">
                Standard-Verbindlichkeit
                <select value={formState.defaultRigidity} onChange={(event) => updateSource(source.id, { defaultRigidity: event.target.value })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal">
                  {rigidityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>

              <label className="grid gap-2 font-bold">
                Standard-Kategorie
                <select value={formState.defaultCategory} onChange={(event) => updateSource(source.id, { defaultCategory: event.target.value })} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal">
                  {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>

            <fieldset className="mt-5 rounded-2xl border border-slate-200 p-4">
              <legend className="px-2 font-bold">Default-Personen</legend>
              {familyMembers.length ? (
                <div className="flex flex-wrap gap-3">
                  {familyMembers.map((member) => (
                    <label key={member.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 font-bold">
                      <input type="checkbox" checked={formState.defaultPersonIds.includes(member.id)} onChange={() => togglePerson(source.id, member.id)} />
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: member.color }} aria-hidden="true" />
                      {member.shortName} <span className="font-normal text-slate-500">({member.displayName})</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">Keine aktiven Familienmitglieder vorhanden.</p>
              )}
              <p className="mt-3 text-sm text-slate-500">Diese Personen werden verwendet, wenn ein Kalendertermin keine Personen-Tags enthält.</p>
            </fieldset>

            {saveState === "saved" ? <p className="mt-4 rounded-2xl bg-emerald-50 p-3 font-bold text-emerald-800">Kalenderquelle gespeichert. Der nächste Sync verwendet die neuen Defaults.</p> : null}
            {saveState === "error" ? <p className="mt-4 rounded-2xl bg-red-50 p-3 font-bold text-red-800">{error}</p> : null}
          </form>
        );
      })}
    </div>
  );
}
