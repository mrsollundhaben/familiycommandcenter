"use client";

import { useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

export function TaskDoneButton({ taskId, isDone }: { taskId: string; isDone: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await fetch(`/api/tasks/${taskId}/done`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isDone: !isDone })
          });
          window.location.reload();
        });
      }}
      className="mt-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-2xl font-black text-white disabled:opacity-60"
    >
      <CheckCircle2 className="h-8 w-8" />
      {isDone ? "Wieder öffnen" : "Erledigt"}
    </button>
  );
}
