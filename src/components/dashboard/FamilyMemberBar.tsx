import type { DashboardItem, DashboardPerson } from "@/domain/events/types";

export function FamilyMemberBar({ people, items }: { people: DashboardPerson[]; items: DashboardItem[] }) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-3">
        {people.map((person) => {
          const count = items.filter((item) => item.personIds.includes(person.id)).length;
          return (
            <div key={person.id} className="flex items-center gap-2 rounded-full px-4 py-2 text-xl font-black text-white" style={{ backgroundColor: person.color }}>
              <span>{person.icon}</span>
              <span>{person.shortName}</span>
              <span className="rounded-full bg-white/25 px-2">{count}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
