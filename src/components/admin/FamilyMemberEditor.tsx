"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type FamilyMemberRole = "parent" | "child";

type FamilyMemberEditorMember = {
  id: string;
  displayName: string;
  shortName: string;
  role: string;
  color: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
};

type MemberFormState = {
  displayName: string;
  shortName: string;
  role: FamilyMemberRole;
  color: string;
  icon: string;
  sortOrder: string;
  isActive: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const roleOptions: Array<{ value: FamilyMemberRole; label: string }> = [
  { value: "parent", label: "Elternteil" },
  { value: "child", label: "Kind" }
];

function toFormState(member: FamilyMemberEditorMember): MemberFormState {
  return {
    displayName: member.displayName,
    shortName: member.shortName,
    role: member.role === "parent" ? "parent" : "child",
    color: member.color,
    icon: member.icon ?? "",
    sortOrder: String(member.sortOrder),
    isActive: member.isActive
  };
}

function colorPickerValue(color: string) {
  return /^#[0-9a-f]{6}$/iu.test(color) ? color : "#0f172a";
}

function announceFamilyMemberUpdate() {
  const message = { type: "family-members-updated", timestamp: Date.now() };

  window.localStorage.setItem("family-members-updated", String(message.timestamp));

  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel("family-command-center");
    channel.postMessage(message);
    channel.close();
  }
}

export function FamilyMemberEditor({ members }: { members: FamilyMemberEditorMember[] }) {
  const router = useRouter();
  const [formStates, setFormStates] = useState<Record<string, MemberFormState>>(() => Object.fromEntries(members.map((member) => [member.id, toFormState(member)])));
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const sortedMembers = useMemo(() => [...members].sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName, "de")), [members]);

  function updateMember(id: string, update: Partial<MemberFormState>) {
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

  async function saveMember(event: FormEvent<HTMLFormElement>, memberId: string) {
    event.preventDefault();
    const formState = formStates[memberId];
    if (!formState) return;

    const trimmedDisplayName = formState.displayName.trim();
    const trimmedShortName = formState.shortName.trim();
    const trimmedColor = formState.color.trim();
    const trimmedIcon = formState.icon.trim();
    const parsedSortOrder = Number(formState.sortOrder);

    if (!trimmedDisplayName || !trimmedShortName || !trimmedColor || !Number.isInteger(parsedSortOrder)) {
      setSaveStates((current) => ({ ...current, [memberId]: "error" }));
      setErrors((current) => ({ ...current, [memberId]: "Bitte Name, Kurzname, Farbe und eine ganze Sortierzahl ausfüllen." }));
      return;
    }

    setSaveStates((current) => ({ ...current, [memberId]: "saving" }));
    setErrors((current) => ({ ...current, [memberId]: "" }));

    const response = await fetch(`/api/admin/family-members/${encodeURIComponent(memberId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: trimmedDisplayName,
        shortName: trimmedShortName,
        role: formState.role,
        color: trimmedColor,
        icon: trimmedIcon || null,
        sortOrder: parsedSortOrder,
        isActive: formState.isActive
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      setSaveStates((current) => ({ ...current, [memberId]: "error" }));
      setErrors((current) => ({ ...current, [memberId]: payload?.error?.message ?? "Speichern fehlgeschlagen." }));
      return;
    }

    const payload = await response.json() as { familyMember: FamilyMemberEditorMember };
    setFormStates((current) => ({ ...current, [memberId]: toFormState(payload.familyMember) }));
    setSaveStates((current) => ({ ...current, [memberId]: "saved" }));
    announceFamilyMemberUpdate();
    router.refresh();
  }

  if (members.length === 0) {
    return <p className="rounded-3xl bg-white p-6 text-xl">Noch keine Familienmitglieder vorhanden.</p>;
  }

  return (
    <div className="grid gap-4">
      {sortedMembers.map((member) => {
        const formState = formStates[member.id] ?? toFormState(member);
        const saveState = saveStates[member.id] ?? "idle";
        const error = errors[member.id];
        const previewIcon = formState.icon.trim();

        return (
          <form key={member.id} onSubmit={(event) => void saveMember(event, member.id)} className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-16 min-w-16 items-center justify-center rounded-full px-4 text-2xl font-black text-white shadow-sm" style={{ backgroundColor: formState.color || "#0f172a" }} aria-label={`Avatar-Vorschau für ${formState.displayName || member.displayName}`}>
                  {previewIcon ? <span className="mr-1">{previewIcon}</span> : null}
                  <span>{formState.shortName || member.shortName}</span>
                </span>
                <div>
                  <h2 className="text-2xl font-black">{formState.displayName || member.displayName}</h2>
                  <p className="text-sm text-slate-500">ID bleibt unverändert: {member.id}</p>
                </div>
              </div>
              <button type="submit" disabled={saveState === "saving"} className="rounded-full bg-slate-950 px-5 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">
                {saveState === "saving" ? "Speichere…" : "Speichern"}
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 font-semibold text-slate-700">
                Anzeigename
                <input value={formState.displayName} onChange={(event) => updateMember(member.id, { displayName: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-lg text-slate-950" required />
              </label>
              <label className="grid gap-2 font-semibold text-slate-700">
                Kurzname
                <input value={formState.shortName} onChange={(event) => updateMember(member.id, { shortName: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-lg text-slate-950" required />
              </label>
              <label className="grid gap-2 font-semibold text-slate-700">
                Rolle
                <select value={formState.role} onChange={(event) => updateMember(member.id, { role: event.target.value as FamilyMemberRole })} className="rounded-2xl border border-slate-200 px-4 py-3 text-lg text-slate-950">
                  {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="grid gap-2 font-semibold text-slate-700">
                Sortierung
                <input type="number" step="1" value={formState.sortOrder} onChange={(event) => updateMember(member.id, { sortOrder: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-lg text-slate-950" required />
              </label>
              <label className="grid gap-2 font-semibold text-slate-700">
                Farbe
                <span className="flex gap-3">
                  <input type="color" value={colorPickerValue(formState.color)} onChange={(event) => updateMember(member.id, { color: event.target.value })} className="h-14 w-16 rounded-2xl border border-slate-200 bg-white p-1" aria-label="Farbe wählen" />
                  <input value={formState.color} onChange={(event) => updateMember(member.id, { color: event.target.value })} className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-lg text-slate-950" required />
                </span>
              </label>
              <label className="grid gap-2 font-semibold text-slate-700">
                Icon / Emoji
                <input value={formState.icon} onChange={(event) => updateMember(member.id, { icon: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3 text-lg text-slate-950" placeholder="z. B. 🧒" />
              </label>
            </div>

            <label className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-700">
              <input type="checkbox" checked={formState.isActive} onChange={(event) => updateMember(member.id, { isActive: event.target.checked })} className="h-5 w-5" />
              Aktiv im Dashboard anzeigen
            </label>

            <div className="mt-4 min-h-6 text-sm font-semibold">
              {saveState === "saved" ? <p className="text-emerald-700">Gespeichert. Dashboard wird aktualisiert.</p> : null}
              {error ? <p className="text-red-700">{error}</p> : null}
            </div>
          </form>
        );
      })}
    </div>
  );
}
