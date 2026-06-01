import { format, isSameDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { prisma } from "@/server/db/prisma";
import { env } from "@/server/config/env";
import { findCurrent, findNext, formatCountdown, minutesUntil } from "@/domain/events/grouping";
import type { DashboardItem, DashboardToday } from "@/domain/events/types";
import type { EventCategory, Importance, Rigidity } from "@/domain/events/valueTypes";

function personIdsFromLinks(links: Array<{ familyMemberId: string }>) {
  return links.map((link) => link.familyMemberId);
}

export async function getDashboardToday(date = new Date()): Promise<DashboardToday> {
  const zoned = toZonedTime(date, env.DEFAULT_TIMEZONE);
  const startWallTime = new Date(zoned);
  startWallTime.setHours(0, 0, 0, 0);
  const endWallTime = new Date(startWallTime);
  endWallTime.setDate(startWallTime.getDate() + env.SYNC_DAYS_AHEAD);
  endWallTime.setHours(23, 59, 59, 999);
  const start = fromZonedTime(startWallTime, env.DEFAULT_TIMEZONE);
  const end = fromZonedTime(endWallTime, env.DEFAULT_TIMEZONE);

  const [members, events, tasks, lastSync] = await Promise.all([
    prisma.familyMember.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.familyEvent.findMany({
      where: { deletedAt: null, startDateTime: { gte: start, lte: end } },
      include: { persons: true },
      orderBy: { startDateTime: "asc" }
    }),
    prisma.task.findMany({ include: { persons: true }, orderBy: [{ isDone: "asc" }, { sortOrder: "asc" }] }),
    prisma.syncLog.findFirst({ orderBy: { startedAt: "desc" } })
  ]);

  const eventItems: DashboardItem[] = events.map((event) => ({
    id: event.id,
    kind: "event",
    title: event.title,
    startDateTime: event.startDateTime.toISOString(),
    endDateTime: event.endDateTime?.toISOString() ?? null,
    isAllDay: event.isAllDay,
    personIds: personIdsFromLinks(event.persons),
    rigidity: event.rigidity as Rigidity,
    category: event.category as EventCategory,
    importance: event.importance as Importance,
    preparationNotes: event.preparationNotes,
    location: event.location,
    isDone: event.isDone
  }));

  const taskItems: DashboardItem[] = tasks
    .filter((task) => !task.dueDate || isSameDay(task.dueDate, zoned))
    .map((task) => ({
      id: task.id,
      kind: "task",
      title: task.title,
      dueDateTime: task.dueDate?.toISOString() ?? null,
      personIds: personIdsFromLinks(task.persons),
      rigidity: task.rigidity as Rigidity,
      category: "task",
      importance: "normal",
      isDone: task.isDone
    }));

  const allItems = [...eventItems, ...taskItems];
  const current = findCurrent(eventItems, date);
  const next = findNext(eventItems, date);
  const nextCountdownMinutes = next ? minutesUntil(next.startDateTime!, date) : null;

  return {
    date: format(zoned, "yyyy-MM-dd"),
    timezone: env.DEFAULT_TIMEZONE,
    now: date.toISOString(),
    sync: {
      lastSyncAt: lastSync?.finishedAt?.toISOString() ?? lastSync?.startedAt?.toISOString() ?? null,
      status: lastSync?.status ?? null,
      isStale: lastSync ? Date.now() - lastSync.startedAt.getTime() > 30 * 60 * 1000 : true
    },
    current,
    next: next && nextCountdownMinutes !== null ? { ...next, countdownMinutes: nextCountdownMinutes, countdownLabel: formatCountdown(nextCountdownMinutes) } : null,
    sections: {
      allDay: eventItems.filter((item) => item.isAllDay),
      later: eventItems.filter((item) => !item.isAllDay),
      tasks: taskItems
    },
    familyMembers: members.map((member) => ({
      id: member.id,
      displayName: member.displayName,
      shortName: member.shortName,
      color: member.color,
      icon: member.icon
    }))
  };
}
