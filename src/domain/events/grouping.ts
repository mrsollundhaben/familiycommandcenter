import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import type { DashboardDaySection, DashboardItem } from "./types";

const FUTURE_DAY_ITEM_LIMIT = 4;
const DASHBOARD_DAY_COUNT = 4;

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

export function localDateKey(date: Date, timezone: string) {
  return format(toZonedTime(date, timezone), "yyyy-MM-dd");
}

function itemDateKey(item: DashboardItem, timezone: string) {
  const itemDate = item.startDateTime ?? item.dueDateTime;
  return itemDate ? localDateKey(new Date(itemDate), timezone) : null;
}

function dashboardLabel(dayOffset: number) {
  if (dayOffset === 0) return "Heute";
  if (dayOffset === 1) return "Morgen";
  if (dayOffset === 2) return "Übermorgen";
  return `Tag ${dayOffset}`;
}

function isRelevantForFutureDay(item: DashboardItem) {
  if (item.kind === "task") return !item.isDone;
  return item.rigidity === "fixed" || item.importance === "important" || item.importance === "critical";
}

function sortDashboardItems(a: DashboardItem, b: DashboardItem) {
  if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;

  const aTime = a.startDateTime ?? a.dueDateTime;
  const bTime = b.startDateTime ?? b.dueDateTime;

  if (!aTime && !bTime) return a.title.localeCompare(b.title);
  if (!aTime) return 1;
  if (!bTime) return -1;

  return new Date(aTime).getTime() - new Date(bTime).getTime();
}

export function groupDashboardDays(items: DashboardItem[], date: Date, timezone: string): DashboardDaySection[] {
  const startOfToday = toZonedTime(date, timezone);
  startOfToday.setHours(0, 0, 0, 0);

  const todayKey = format(startOfToday, "yyyy-MM-dd");
  const itemsByDate = new Map<string, DashboardItem[]>();
  for (const item of items) {
    const key = itemDateKey(item, timezone) ?? todayKey;
    itemsByDate.set(key, [...(itemsByDate.get(key) ?? []), item]);
  }

  return Array.from({ length: DASHBOARD_DAY_COUNT }, (_, dayOffset) => {
    const key = format(addDays(startOfToday, dayOffset), "yyyy-MM-dd");
    const dayItems = [...(itemsByDate.get(key) ?? [])].sort(sortDashboardItems);
    const visibleItems = dayOffset === 0 ? dayItems : dayItems.filter(isRelevantForFutureDay).slice(0, FUTURE_DAY_ITEM_LIMIT);
    const hiddenItemCount = Math.max(0, dayItems.length - visibleItems.length);

    return {
      date: key,
      label: dashboardLabel(dayOffset),
      dayOffset,
      items: visibleItems,
      totalItemCount: dayItems.length,
      hiddenItemCount,
      isLimited: dayOffset > 0
    };
  });
}
