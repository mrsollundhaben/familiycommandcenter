"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

type TaskDoneButtonProps = {
  taskId: string;
  isDone: boolean;
  completionDate?: string;
  onDoneChanged?: (isDone: boolean, taskId: string) => Promise<void> | void;
};

export function TaskDoneButton({ taskId, isDone, completionDate, onDoneChanged }: TaskDoneButtonProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleDone() {
    const nextDoneState = !isDone;
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/done`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDone: nextDoneState, date: completionDate })
      });

      if (!response.ok) {
        throw new Error(`Task konnte nicht gespeichert werden (${response.status})`);
      }

      await onDoneChanged?.(nextDoneState, taskId);
    } catch {
      setError("Hat nicht geklappt, bitte nochmal tippen");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={isSaving}
        aria-busy={isSaving}
        onClick={() => void toggleDone()}
        className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-2xl font-black text-white disabled:opacity-60"
      >
        {isSaving ? <Loader2 className="h-8 w-8 animate-spin" /> : <CheckCircle2 className="h-8 w-8" />}
        {isSaving ? "Speichere…" : isDone ? "Wieder öffnen" : "Erledigt"}
      </button>
      {error ? <p className="mt-2 rounded-2xl bg-white/80 px-4 py-2 text-xl font-black text-red-700">{error}</p> : null}
    </div>
  );
}
