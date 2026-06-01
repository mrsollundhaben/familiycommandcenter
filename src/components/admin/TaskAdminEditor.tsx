"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import type { TaskRecurrence } from "@/domain/tasks/recurrence";

type Rigidity = "fixed" | "flexible" | "optional";
type RecurrenceType = "none" | "daily" | "weekdays" | "weekly";
type SaveState = "idle" | "saving" | "saved" | "error";

type TaskAdminFamilyMember = {
  id: string;
  displayName: string;
  shortName: string;
  color: string;
  icon: string | null;
};

type TaskAdminTask = {
  id: string;
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  rigidity: string;
  recurrence: TaskRecurrence | null;
  sortOrder: number;
  isDone: boolean;
  persons: Array<{ familyMemberId: string }>;
};

type TaskFormState = {
  title: string;
  personIds: string[];
  dueDate: string;
  dueTime: string;
  rigidity: Rigidity;
  recurrenceType: RecurrenceType;
  weeklyDays: string[];
  sortOrder: string;
  isDone: boolean;
};

const taskFormSchema = z.object({
  title: z.string().trim().min(1, "Bitte einen Titel eintragen."),
  personIds: z.array(z.string()),
  dueDate: z.string().date().or(z.literal("")),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Bitte eine Uhrzeit im Format HH:mm eintragen.").or(z.literal("")),
  rigidity: z.enum(["fixed", "flexible", "optional"]),
  recurrenceType: z.enum(["none", "daily", "weekdays", "weekly"]),
  weeklyDays: z.array(z.string()),
  sortOrder: z.coerce.number().int(),
  isDone: z.boolean()
});

const emptyTaskFormState: TaskFormState = {
  title: "",
  personIds: [],
  dueDate: "",
  dueTime: "",
  rigidity: "flexible",
  recurrenceType: "none",
  weeklyDays: [],
  sortOrder: "0",
  isDone: false
};

const weekdayOptions = [
  { value: "1", label: "Mo" },
  { value: "2", label: "Di" },
  { value: "3", label: "Mi" },
  { value: "4", label: "Do" },
  { value: "5", label: "Fr" },
  { value: "6", label: "Sa" },
  { value: "7", label: "So" }
];

const recurrenceOptions: Array<{ value: RecurrenceType; label: string }> = [
  { value: "none", label: "Keine Wiederholung" },
  { value: "daily", label: "Täglich" },
  { value: "weekdays", label: "Werktags (Mo–Fr)" },
  { value: "weekly", label: "Wöchentlich an ausgewählten Tagen" }
];

const rigidityOptions: Array<{ value: Rigidity; label: string }> = [
  { value: "fixed", label: "🔴 Fix" },
  { value: "flexible", label: "🟡 Flexibel" },
  { value: "optional", label: "🟢 Optional" }
];

function dateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function recurrenceToFormState(recurrence: TaskRecurrence | null): Pick<TaskFormState, "recurrenceType" | "weeklyDays"> {
  if (!recurrence) return { recurrenceType: "none", weeklyDays: [] };
  if (recurrence.type === "weekly") return { recurrenceType: "weekly", weeklyDays: recurrence.days.map(String) };
  return { recurrenceType: recurrence.type, weeklyDays: [] };
}

function recurrenceFromFormState(formState: Pick<TaskFormState, "recurrenceType" | "weeklyDays">): TaskRecurrence | null {
  if (formState.recurrenceType === "none") return null;
  if (formState.recurrenceType === "daily") return { type: "daily" };
  if (formState.recurrenceType === "weekdays") return { type: "weekdays" };
  return { type: "weekly", days: [...new Set(formState.weeklyDays.map(Number))].sort((a, b) => a - b) };
}

function toFormState(task: TaskAdminTask): TaskFormState {
  return {
    title: task.title,
    personIds: task.persons.map((person) => person.familyMemberId),
    dueDate: dateInputValue(task.dueDate),
    dueTime: task.dueTime ?? "",
    rigidity: task.rigidity === "fixed" || task.rigidity === "optional" ? task.rigidity : "flexible",
    ...recurrenceToFormState(task.recurrence),
    sortOrder: String(task.sortOrder),
    isDone: task.isDone
  };
}

function taskPayload(formState: TaskFormState) {
  const result = taskFormSchema.safeParse(formState);
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Bitte die Formularfelder prüfen." };
  }

  const recurrence = recurrenceFromFormState(result.data);
  if (recurrence?.type === "weekly" && recurrence.days.length === 0) {
    return { error: "Bitte mindestens einen Wochentag für die wöchentliche Wiederholung auswählen." };
  }

  return {
    payload: {
      title: result.data.title.trim(),
      personIds: [...new Set(result.data.personIds)],
      dueDate: result.data.dueDate || null,
      dueTime: result.data.dueTime || null,
      rigidity: result.data.rigidity,
      recurrence,
      sortOrder: result.data.sortOrder,
      isDone: result.data.isDone
    }
  };
}

function announceTaskUpdate() {
  const message = { type: "tasks-updated", timestamp: Date.now() };

  window.localStorage.setItem("tasks-updated", String(message.timestamp));

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel("family-command-center");
    channel.postMessage(message);
    channel.close();
  }
}

function statusText(saveState: SaveState) {
  if (saveState === "saving") return "Speichere…";
  if (saveState === "saved") return "Gespeichert. Dashboard wird aktualisiert.";
  if (saveState === "error") return "Speichern fehlgeschlagen.";
  return "";
}

function assignedNames(task: TaskAdminTask, membersById: Map<string, TaskAdminFamilyMember>) {
  return task.persons
    .map((person) => membersById.get(person.familyMemberId)?.shortName)
    .filter(Boolean)
    .join(", ");
}

export function TaskAdminEditor({ tasks, familyMembers }: { tasks: TaskAdminTask[]; familyMembers: TaskAdminFamilyMember[] }) {
  const router = useRouter();
  const [newTask, setNewTask] = useState<TaskFormState>(() => ({ ...emptyTaskFormState }));
  const [formStates, setFormStates] = useState<Record<string, TaskFormState>>(() => Object.fromEntries(tasks.map((task) => [task.id, toFormState(task)])));
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({ new: "idle" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const membersById = useMemo(() => new Map(familyMembers.map((member) => [member.id, member])), [familyMembers]);
  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "de")), [tasks]);

  function updateNewTask(update: Partial<TaskFormState>) {
    setNewTask((current) => ({ ...current, ...update }));
    setSaveStates((current) => ({ ...current, new: "idle" }));
    setErrors((current) => ({ ...current, new: "" }));
  }

  function updateTask(id: string, update: Partial<TaskFormState>) {
    setFormStates((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? emptyTaskFormState),
        ...update
      }
    }));
    setSaveStates((current) => ({ ...current, [id]: "idle" }));
    setErrors((current) => ({ ...current, [id]: "" }));
  }

  function togglePerson(formState: TaskFormState, personId: string, checked: boolean) {
    return checked ? [...formState.personIds, personId] : formState.personIds.filter((id) => id !== personId);
  }

  function toggleWeeklyDay(formState: TaskFormState, day: string, checked: boolean) {
    return checked ? [...formState.weeklyDays, day] : formState.weeklyDays.filter((value) => value !== day);
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = taskPayload(newTask);
    if ("error" in parsed) {
      setSaveStates((current) => ({ ...current, new: "error" }));
      setErrors((current) => ({ ...current, new: parsed.error }));
      return;
    }

    setSaveStates((current) => ({ ...current, new: "saving" }));
    setErrors((current) => ({ ...current, new: "" }));

    const response = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.payload)
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      setSaveStates((current) => ({ ...current, new: "error" }));
      setErrors((current) => ({ ...current, new: payload?.error?.message ?? "Aufgabe konnte nicht angelegt werden." }));
      return;
    }

    setNewTask({ ...emptyTaskFormState });
    setSaveStates((current) => ({ ...current, new: "saved" }));
    announceTaskUpdate();
    router.refresh();
  }

  async function saveTask(event: FormEvent<HTMLFormElement>, taskId: string) {
    event.preventDefault();
    const formState = formStates[taskId];
    if (!formState) return;

    const parsed = taskPayload(formState);
    if ("error" in parsed) {
      setSaveStates((current) => ({ ...current, [taskId]: "error" }));
      setErrors((current) => ({ ...current, [taskId]: parsed.error }));
      return;
    }

    setSaveStates((current) => ({ ...current, [taskId]: "saving" }));
    setErrors((current) => ({ ...current, [taskId]: "" }));

    const response = await fetch(`/api/admin/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.payload)
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      setSaveStates((current) => ({ ...current, [taskId]: "error" }));
      setErrors((current) => ({ ...current, [taskId]: payload?.error?.message ?? "Aufgabe konnte nicht gespeichert werden." }));
      return;
    }

    const payload = await response.json() as { task: TaskAdminTask };
    setFormStates((current) => ({ ...current, [taskId]: toFormState(payload.task) }));
    setSaveStates((current) => ({ ...current, [taskId]: "saved" }));
    announceTaskUpdate();
    router.refresh();
  }

  async function deleteTask(taskId: string) {
    if (!window.confirm("Diese Aufgabe wirklich löschen?")) return;

    setSaveStates((current) => ({ ...current, [taskId]: "saving" }));
    setErrors((current) => ({ ...current, [taskId]: "" }));

    const response = await fetch(`/api/admin/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      setSaveStates((current) => ({ ...current, [taskId]: "error" }));
      setErrors((current) => ({ ...current, [taskId]: payload?.error?.message ?? "Aufgabe konnte nicht gelöscht werden." }));
      return;
    }

    setSaveStates((current) => ({ ...current, [taskId]: "saved" }));
    announceTaskUpdate();
    router.refresh();
  }

  function renderTaskFields(formState: TaskFormState, onUpdate: (update: Partial<TaskFormState>) => void) {
    return (
      <>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 font-semibold text-slate-700 md:col-span-2">
            Titel
            <input value={formState.title} onChange={(event) => onUpdate({ title: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-lg text-slate-950" required />
          </label>
          <label className="grid gap-2 font-semibold text-slate-700">
            Fälligkeitsdatum
            <input type="date" value={formState.dueDate} onChange={(event) => onUpdate({ dueDate: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-lg text-slate-950" />
          </label>
          <label className="grid gap-2 font-semibold text-slate-700">
            Fälligkeitszeit
            <input type="time" value={formState.dueTime} onChange={(event) => onUpdate({ dueTime: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-lg text-slate-950" />
          </label>
          <label className="grid gap-2 font-semibold text-slate-700">
            Wiederholung
            <select value={formState.recurrenceType} onChange={(event) => onUpdate({ recurrenceType: event.target.value as RecurrenceType })} className="rounded-2xl border border-slate-200 px-4 py-3 text-lg text-slate-950">
              {recurrenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {formState.recurrenceType === "weekly" ? (
            <fieldset className="rounded-2xl border border-slate-200 px-4 py-3">
              <legend className="font-semibold text-slate-700">Wochentage</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {weekdayOptions.map((day) => (
                  <label key={day.value} className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 font-bold text-slate-800">
                    <input type="checkbox" checked={formState.weeklyDays.includes(day.value)} onChange={(event) => onUpdate({ weeklyDays: toggleWeeklyDay(formState, day.value, event.target.checked) })} className="h-4 w-4" />
                    {day.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <label className="grid gap-2 font-semibold text-slate-700">
            Verbindlichkeit
            <select value={formState.rigidity} onChange={(event) => onUpdate({ rigidity: event.target.value as Rigidity })} className="rounded-2xl border border-slate-200 px-4 py-3 text-lg text-slate-950">
              {rigidityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid gap-2 font-semibold text-slate-700">
            Sortierung
            <input type="number" step="1" value={formState.sortOrder} onChange={(event) => onUpdate({ sortOrder: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-lg text-slate-950" required />
          </label>
        </div>

        <fieldset className="mt-4 rounded-2xl bg-slate-50 p-4">
          <legend className="mb-3 font-black text-slate-800">Zugeordnete Personen</legend>
          {familyMembers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {familyMembers.map((member) => (
                <label key={member.id} className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 font-bold text-slate-800 shadow-sm">
                  <input type="checkbox" checked={formState.personIds.includes(member.id)} onChange={(event) => onUpdate({ personIds: togglePerson(formState, member.id, event.target.checked) })} className="h-4 w-4" />
                  <span className="rounded-full px-2 py-1 text-sm text-white" style={{ backgroundColor: member.color }}>{member.icon} {member.shortName}</span>
                  {member.displayName}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-slate-600">Keine aktiven Familienmitglieder vorhanden.</p>
          )}
        </fieldset>

        <label className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-700">
          <input type="checkbox" checked={formState.isDone} onChange={(event) => onUpdate({ isDone: event.target.checked })} className="h-5 w-5" />
          Aufgabe ist erledigt
        </label>
      </>
    );
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={(event) => void createTask(event)} className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Neue Aufgabe</h2>
            <p className="text-slate-600">Lokale Aufgaben erscheinen nach dem Speichern im Dashboard.</p>
          </div>
          <button type="submit" disabled={saveStates.new === "saving"} className="rounded-full bg-emerald-700 px-5 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">
            {saveStates.new === "saving" ? "Lege an…" : "Aufgabe anlegen"}
          </button>
        </div>

        {renderTaskFields(newTask, updateNewTask)}

        <div className="mt-4 min-h-6 text-sm font-semibold">
          {saveStates.new === "saved" ? <p className="text-emerald-700">{statusText(saveStates.new)}</p> : null}
          {errors.new ? <p className="text-red-700">{errors.new}</p> : null}
        </div>
      </form>

      <section className="grid gap-4" aria-label="Vorhandene Aufgaben">
        {sortedTasks.length ? sortedTasks.map((task) => {
          const formState = formStates[task.id] ?? toFormState(task);
          const saveState = saveStates[task.id] ?? "idle";
          const error = errors[task.id];
          const people = assignedNames(task, membersById);

          return (
            <form key={task.id} onSubmit={(event) => void saveTask(event, task.id)} className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">{formState.isDone ? "✅" : "⬜"} {formState.title || task.title}</h2>
                  <p className="text-sm text-slate-500">ID: {task.id}{people ? ` · Personen: ${people}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={saveState === "saving"} onClick={() => void deleteTask(task.id)} className="rounded-full bg-red-50 px-5 py-2 font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                    Löschen
                  </button>
                  <button type="submit" disabled={saveState === "saving"} className="rounded-full bg-slate-950 px-5 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">
                    {saveState === "saving" ? "Speichere…" : "Speichern"}
                  </button>
                </div>
              </div>

              {renderTaskFields(formState, (update) => updateTask(task.id, update))}

              <div className="mt-4 min-h-6 text-sm font-semibold">
                {saveState === "saved" ? <p className="text-emerald-700">{statusText(saveState)}</p> : null}
                {error ? <p className="text-red-700">{error}</p> : null}
              </div>
            </form>
          );
        }) : <p className="rounded-3xl bg-white p-6 text-xl">Noch keine lokalen Aufgaben vorhanden.</p>}
      </section>
    </div>
  );
}
