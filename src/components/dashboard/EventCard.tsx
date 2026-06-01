import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CheckCircle2, Clock, MapPin, Package } from "lucide-react";
import type { DashboardItem, DashboardPerson } from "@/domain/events/types";
import { TaskDoneButton } from "./TaskDoneButton";

const rigidityStyles = {
  fixed: "border-red-400 bg-red-50 text-red-950",
  flexible: "border-amber-400 bg-amber-50 text-amber-950",
  optional: "border-emerald-400 bg-emerald-50 text-emerald-950"
};

const rigidityLabel = {
  fixed: "🔴 Fix",
  flexible: "🟡 Flexibel",
  optional: "🟢 Optional"
};

function timeLabel(item: DashboardItem) {
  if (item.isAllDay) return "ganztägig";
  if (!item.startDateTime) return item.dueDateTime ? `bis ${format(new Date(item.dueDateTime), "HH:mm", { locale: de })}` : "Aufgabe";
  return format(new Date(item.startDateTime), "HH:mm", { locale: de });
}

export function EventCard({ item, people }: { item: DashboardItem; people: DashboardPerson[] }) {
  const assigned = people.filter((person) => item.personIds.includes(person.id));
  return (
    <article className={`rounded-3xl border-4 p-5 shadow-sm ${rigidityStyles[item.rigidity]} ${item.isDone ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-2xl font-black">
            {item.isDone ? <CheckCircle2 className="h-8 w-8" /> : <Clock className="h-8 w-8" />}
            <span>{timeLabel(item)}</span>
          </div>
          <h3 className="text-4xl font-black leading-tight">{item.title}</h3>
        </div>
        <div className="rounded-full bg-white/70 px-4 py-2 text-xl font-bold">{rigidityLabel[item.rigidity]}</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {assigned.map((person) => (
          <span key={person.id} className="rounded-full px-3 py-1 text-lg font-bold text-white" style={{ backgroundColor: person.color }}>
            {person.icon} {person.shortName}
          </span>
        ))}
      </div>

      {item.kind === "task" ? <TaskDoneButton taskId={item.id} isDone={item.isDone} /> : null}

      {(item.preparationNotes || item.location) && (
        <div className="mt-4 grid gap-2 text-xl font-semibold">
          {item.preparationNotes ? <p className="flex items-center gap-2"><Package /> {item.preparationNotes}</p> : null}
          {item.location ? <p className="flex items-center gap-2"><MapPin /> {item.location}</p> : null}
        </div>
      )}
    </article>
  );
}
