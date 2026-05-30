import type { DashboardItem } from "./types";

export function minutesUntil(dateIso: string, now = new Date()) {
  return Math.max(0, Math.round((new Date(dateIso).getTime() - now.getTime()) / 60000));
}

export function findCurrent(items: DashboardItem[], now = new Date()) {
  return items.find((item) => {
    if (!item.startDateTime || item.isAllDay || item.isDone) return false;
    const start = new Date(item.startDateTime).getTime();
    const end = item.endDateTime ? new Date(item.endDateTime).getTime() : start + 30 * 60000;
    return start <= now.getTime() && now.getTime() <= end;
  }) ?? null;
}

export function findNext(items: DashboardItem[], now = new Date()) {
  const future = items
    .filter((item) => item.startDateTime && !item.isAllDay && !item.isDone && new Date(item.startDateTime).getTime() > now.getTime())
    .sort((a, b) => new Date(a.startDateTime!).getTime() - new Date(b.startDateTime!).getTime());
  const fixed = future.find((item) => item.rigidity === "fixed");
  return fixed ?? future[0] ?? null;
}
