import { format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { prisma } from "@/server/db/prisma";
import { env } from "@/server/config/env";
import { findCurrent, findNext, groupDashboardDays, localDateKey, minutesUntil } from "@/domain/events/grouping";
import { isRecurringTaskDueOnDate, parseTaskRecurrence } from "@/domain/tasks/recurrence";
import { buildPreparationHints } from "@/domain/events/preparation";
import type { DashboardItem, DashboardToday } from "@/domain/events/types";
import type { EventCategory, Importance, Rigidity } from "@/domain/events/valueTypes";

function personIdsFromLinks(links: Array<{ familyMemberId: string }>) {
  return links.map((link) => link.familyMemberId);
}

function taskDueDateTimeIso(task: { dueDate: Date | null; dueTime: string | null }) {
  if (!task.dueDate) return null;

  const dateKey = localDateKey(task.dueDate, env.DEFAULT_TIMEZONE);
  return taskOccurrenceDateTimeIso(dateKey, task.dueTime);
}

function taskOccurrenceDateTimeIso(dateKey: string, dueTime: string | null) {
  const time = dueTime ?? "00:00";
  return fromZonedTime(`${dateKey}T${time}:00`, env.DEFAULT_TIMEZONE).toISOString();
}

function isOnOrAfterStartDate(task: { dueDate: Date | null }, dateKey: string) {
  if (!task.dueDate) return true;
  return dateKey >= localDateKey(task.dueDate, env.DEFAULT_TIMEZONE);
}

export async function getDashboardToday(date = new Date()): Promise<DashboardToday> {
  const daysAhead = Math.max(env.SYNC_DAYS_AHEAD, 3);
  const zoned = toZonedTime(date, env.DEFAULT_TIMEZONE);
  const startWallTime = new Date(zoned);
  startWallTime.setHours(0, 0, 0, 0);
  const endWallTime = new Date(startWallTime);
  endWallTime.setDate(startWallTime.getDate() + daysAhead);
  endWallTime.setHours(23, 59, 59, 999);
  const start = fromZonedTime(startWallTime, env.DEFAULT_TIMEZONE);
  const end = fromZonedTime(endWallTime, env.DEFAULT_TIMEZONE);

  const dateKeys = Array.from({ length: daysAhead + 1 }, (_, dayOffset) => {
    const day = new Date(startWallTime);
    day.setDate(startWallTime.getDate() + dayOffset);
    return format(day, "yyyy-MM-dd");
  });

  const [members, events, tasks, taskCompletions, lastSync] = await Promise.all([
    prisma.familyMember.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.familyEvent.findMany({
      where: {
        deletedAt: null,
        startDateTime: { gte: start, lte: end },
        OR: [
          { calendarSource: null },
          { calendarSource: { includeInDashboard: true } }
        ]
      },
      include: { persons: true },
      orderBy: { startDateTime: "asc" }
    }),
    prisma.task.findMany({ include: { persons: true }, orderBy: [{ isDone: "asc" }, { sortOrder: "asc" }] }),
    prisma.taskCompletion.findMany({ where: { date: { in: dateKeys } } }),
    prisma.syncLog.findFirst({ orderBy: { startedAt: "desc" } })
  ]);

  const eventItems: DashboardItem[] = events.map((event) => {
    const preparationHints = buildPreparationHints(
      {
        startDateTime: event.startDateTime,
        isAllDay: event.isAllDay,
        location: event.location,
        preparationNotes: event.preparationNotes
      },
      date
    );

    return {
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
      leaveAt: preparationHints?.leaveAt ?? null,
      prepareAt: preparationHints?.prepareAt ?? null,
      preparationChecklist: preparationHints?.preparationChecklist,
      location: event.location,
      isDone: event.isDone
    };
  });

  const completionsByTaskAndDate = new Map(taskCompletions.map((completion) => [`${completion.taskId}:${completion.date}`, completion]));

  const taskItems: DashboardItem[] = tasks.flatMap((task) => {
    const recurrence = parseTaskRecurrence(task.recurrence);
    const baseTask = {
      id: task.id,
      kind: "task" as const,
      title: task.title,
      personIds: personIdsFromLinks(task.persons),
      rigidity: task.rigidity as Rigidity,
      category: "task" as const,
      importance: "normal" as const
    };

    if (!recurrence) {
      return [{
        ...baseTask,
        dueDateTime: taskDueDateTimeIso(task),
        isDone: task.isDone
      }];
    }

    return dateKeys.flatMap((dateKey) => {
      const occurrenceDate = fromZonedTime(`${dateKey}T12:00:00`, env.DEFAULT_TIMEZONE);
      if (!isOnOrAfterStartDate(task, dateKey) || !isRecurringTaskDueOnDate(recurrence, occurrenceDate)) return [];

      const completion = completionsByTaskAndDate.get(`${task.id}:${dateKey}`);
      return [{
        ...baseTask,
        dueDateTime: taskOccurrenceDateTimeIso(dateKey, task.dueTime),
        isDone: completion?.isDone ?? false,
        completionDate: dateKey
      }];
    });
  });

  const allItems = [...eventItems, ...taskItems];
  const current = findCurrent(eventItems, date);
  const next = findNext(eventItems, date);
  const daySections = groupDashboardDays(allItems, date, env.DEFAULT_TIMEZONE);
  const todaySection = daySections[0];

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
    next: next ? { ...next, countdownMinutes: minutesUntil(next.startDateTime!, date) } : null,
    sections: {
      allDay: todaySection.items.filter((item) => item.kind === "event" && item.isAllDay),
      later: todaySection.items.filter((item) => item.kind === "event" && !item.isAllDay),
      tasks: todaySection.items.filter((item) => item.kind === "task"),
      days: daySections
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
