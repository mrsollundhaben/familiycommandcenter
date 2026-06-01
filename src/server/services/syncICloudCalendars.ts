import { createHash } from "crypto";
import { createDAVClient } from "tsdav";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { prisma } from "@/server/db/prisma";
import { getEnv } from "@/server/config/env";
import { expandICalendarEvents } from "@/server/services/icalExpand";
import { normalizeICloudOccurrence, type NormalizedICloudEvent } from "@/domain/events/icloudMapping";
import { classifyICloudUpsert, getSyncCompletionStatus, hasICloudCredentials } from "@/domain/events/icloudSyncLogic";

type DAVCalendarLike = {
  url: string;
  displayName?: string;
  calendarColor?: string;
  components?: string[];
};

type CalendarObjectLike = {
  url?: string;
  etag?: string;
  data?: string;
};

type SyncCounters = {
  eventsFetched: number;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
};

type SyncError = {
  code: string;
  message: string;
  calendar?: string;
  objectRef?: string;
};

function caldavBaseUrl(caldavUrl: string) {
  return caldavUrl.endsWith("/") ? caldavUrl : `${caldavUrl}/`;
}

type SyncWindowInput = Date | { timezone: string; daysAhead: number; now?: Date };

function syncWindow(input: SyncWindowInput = new Date()) {
  const runtimeEnv = getEnv();
  const timezone = input instanceof Date ? runtimeEnv.DEFAULT_TIMEZONE : input.timezone;
  const daysAhead = input instanceof Date ? runtimeEnv.SYNC_DAYS_AHEAD : input.daysAhead;
  const now = input instanceof Date ? input : input.now ?? new Date();
  const zonedNow = toZonedTime(now, timezone);
  const startWallTime = new Date(zonedNow);
  startWallTime.setHours(0, 0, 0, 0);
  const endWallTime = new Date(startWallTime);
  endWallTime.setDate(startWallTime.getDate() + daysAhead);
  endWallTime.setHours(23, 59, 59, 999);

  return {
    start: fromZonedTime(startWallTime, timezone),
    end: fromZonedTime(endWallTime, timezone)
  };
}

function remoteCalendarName(calendar: DAVCalendarLike) {
  return calendar.displayName?.trim() || calendar.url;
}

function supportsEvents(calendar: DAVCalendarLike) {
  return !calendar.components?.length || calendar.components.includes("VEVENT");
}

function calendarObjectReference(object: CalendarObjectLike, index: number) {
  if (!object.url) return `object-index:${index}`;
  return `sha256:${createHash("sha256").update(object.url).digest("hex").slice(0, 16)}`;
}

function calendarObjectErrorMessage() {
  return "Failed to process iCalendar object.";
}

async function fetchRemoteCalendars(input: { caldavUrl: string; username: string; appPassword: string }) {
  const client = await createDAVClient({
    serverUrl: caldavBaseUrl(input.caldavUrl),
    credentials: {
      username: input.username,
      password: input.appPassword
    },
    authMethod: "Basic",
    defaultAccountType: "caldav"
  });

  return {
    client,
    calendars: ((await client.fetchCalendars()) as DAVCalendarLike[]).filter(supportsEvents)
  };
}

async function ensureCalendarSources(remoteCalendars: DAVCalendarLike[]) {
  const existingBefore = await prisma.calendarSource.findMany();
  for (const calendar of remoteCalendars) {
    const existing = existingBefore.find((source) => source.caldavUrl === calendar.url || source.calendarName === remoteCalendarName(calendar));
    if (!existing) {
      await prisma.calendarSource.create({
        data: {
          name: remoteCalendarName(calendar),
          caldavUrl: calendar.url,
          calendarName: remoteCalendarName(calendar),
          calendarColor: calendar.calendarColor ?? null,
          enabled: true,
          defaultRigidity: "flexible",
          defaultCategory: "appointment"
        }
      });
    } else if (!existing.caldavUrl || existing.calendarColor !== calendar.calendarColor) {
      await prisma.calendarSource.update({
        where: { id: existing.id },
        data: {
          caldavUrl: calendar.url,
          calendarColor: calendar.calendarColor ?? existing.calendarColor
        }
      });
    }
  }

  const allSources = await prisma.calendarSource.findMany({ where: { enabled: true } });
  return existingBefore.length === 0
    ? allSources
    : allSources.filter((source) => existingBefore.some((existing) => existing.id === source.id));
}

function matchRemoteCalendar(source: { caldavUrl: string | null; calendarName: string }, calendars: DAVCalendarLike[]) {
  return calendars.find((calendar) => calendar.url === source.caldavUrl) ?? calendars.find((calendar) => remoteCalendarName(calendar) === source.calendarName);
}

async function replaceEventPersons(eventId: string, personIds: string[]) {
  await prisma.familyEventPerson.deleteMany({ where: { familyEventId: eventId } });
  if (personIds.length > 0) {
    await prisma.familyEventPerson.createMany({
      data: personIds.map((familyMemberId) => ({ familyEventId: eventId, familyMemberId }))
    });
  }
}

async function upsertICloudEvent(event: NormalizedICloudEvent, sourceCalendarId: string) {
  const existing = await prisma.familyEvent.findFirst({ where: { source: "icloud", externalId: event.externalId } });
  const eventData = {
    externalId: event.externalId,
    recurrenceId: event.recurrenceId,
    source: "icloud",
    sourceCalendarId,
    title: event.title,
    originalTitle: event.originalTitle,
    description: event.description,
    location: event.location,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    isAllDay: event.isAllDay,
    rigidity: event.rigidity,
    category: event.category,
    importance: event.importance,
    preparationNotes: event.preparationNotes,
    rawHash: event.rawHash,
    deletedAt: null
  };

  const classification = classifyICloudUpsert(existing, event.rawHash);
  if (classification === "created") {
    const created = await prisma.familyEvent.create({ data: eventData });
    await replaceEventPersons(created.id, event.personIds);
    return classification;
  }

  if (classification === "updated") {
    await prisma.familyEvent.update({ where: { id: existing!.id }, data: eventData });
    await replaceEventPersons(existing!.id, event.personIds);
  }

  return classification;
}

async function markDeletedICloudEvents(input: { sourceCalendarIds: string[]; seenExternalIds: string[]; rangeStart: Date; rangeEnd: Date }) {
  if (input.sourceCalendarIds.length === 0) return 0;

  const staleEvents = await prisma.familyEvent.findMany({
    where: {
      source: "icloud",
      sourceCalendarId: { in: input.sourceCalendarIds },
      deletedAt: null,
      startDateTime: { gte: input.rangeStart, lte: input.rangeEnd },
      NOT: { externalId: { in: input.seenExternalIds } }
    },
    select: { id: true }
  });

  if (staleEvents.length === 0) return 0;
  await prisma.familyEvent.updateMany({
    where: { id: { in: staleEvents.map((event) => event.id) } },
    data: { deletedAt: new Date() }
  });
  return staleEvents.length;
}

async function finishSyncLog(input: { logId: string; counters: SyncCounters; errors: SyncError[]; syncedCalendarIds: string[] }) {
  const status = getSyncCompletionStatus({ errorCount: input.errors.length, syncedCalendarCount: input.syncedCalendarIds.length });
  const message = status === "success"
    ? `iCloud sync completed for ${input.syncedCalendarIds.length} calendar(s).`
    : status === "partial"
      ? `iCloud sync completed partially for ${input.syncedCalendarIds.length} calendar(s).`
      : "iCloud sync failed.";

  return prisma.syncLog.update({
    where: { id: input.logId },
    data: {
      status,
      finishedAt: new Date(),
      message,
      eventsFetched: input.counters.eventsFetched,
      eventsCreated: input.counters.eventsCreated,
      eventsUpdated: input.counters.eventsUpdated,
      eventsDeleted: input.counters.eventsDeleted,
      errors: input.errors.length > 0 ? input.errors : undefined
    }
  });
}

export async function syncICloudCalendars() {
  const runtimeEnv = getEnv();
  const runningLog = await prisma.syncLog.findFirst({
    where: { status: "running", finishedAt: null },
    orderBy: { startedAt: "desc" }
  });
  if (runningLog) {
    console.log(`iCloud sync skipped; sync already running since ${runningLog.startedAt.toISOString()}`);
    return runningLog;
  }

  console.log("iCloud sync started");
  const log = await prisma.syncLog.create({ data: { status: "running", message: "iCloud sync started" } });
  const counters: SyncCounters = { eventsFetched: 0, eventsCreated: 0, eventsUpdated: 0, eventsDeleted: 0 };
  const errors: SyncError[] = [];
  const seenExternalIds = new Set<string>();
  const syncedCalendarIds: string[] = [];

  if (!hasICloudCredentials({ username: runtimeEnv.ICLOUD_USERNAME, appPassword: runtimeEnv.ICLOUD_APP_PASSWORD })) {
    console.log("iCloud sync failed: missing credentials");
    return prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        message: "iCloud credentials are not configured. Set ICLOUD_USERNAME and ICLOUD_APP_PASSWORD.",
        errors: [{ code: "CALDAV_NOT_CONFIGURED", message: "Missing iCloud credentials" }]
      }
    });
  }

  const username = runtimeEnv.ICLOUD_USERNAME!.trim();
  const appPassword = runtimeEnv.ICLOUD_APP_PASSWORD!.trim();
  const { start, end } = syncWindow({ timezone: runtimeEnv.DEFAULT_TIMEZONE, daysAhead: runtimeEnv.SYNC_DAYS_AHEAD });
  try {
    const { client, calendars } = await fetchRemoteCalendars({ caldavUrl: runtimeEnv.CALDAV_URL, username, appPassword });
    console.log(`iCloud calendars found: ${calendars.length}`);
    const sourcesToSync = await ensureCalendarSources(calendars);
    const familyMembers = await prisma.familyMember.findMany({ where: { isActive: true } });

    for (const source of sourcesToSync) {
      const calendar = matchRemoteCalendar(source, calendars);
      if (!calendar) {
        errors.push({ code: "CALENDAR_NOT_FOUND", calendar: source.calendarName, message: "Configured calendar was not found in iCloud." });
        continue;
      }

      try {
        console.log(`Syncing iCloud calendar: ${source.calendarName}`);
        const objects = (await client.fetchCalendarObjects({
          calendar,
          timeRange: { start: start.toISOString(), end: end.toISOString() }
        })) as CalendarObjectLike[];

        let calendarFetched = 0;
        let calendarProcessedEvents = 0;
        let calendarObjectErrors = 0;
        for (const [objectIndex, object] of objects.entries()) {
          if (!object.data) continue;
          const objectRef = calendarObjectReference(object, objectIndex);
          try {
            const occurrences = expandICalendarEvents(object.data, start, end);
            calendarFetched += occurrences.length;
            for (const occurrence of occurrences) {
              const normalized = normalizeICloudOccurrence({ occurrence, calendarSource: source, members: familyMembers });
              seenExternalIds.add(normalized.externalId);
              const result = await upsertICloudEvent(normalized, source.id);
              calendarProcessedEvents += 1;
              if (result === "created") counters.eventsCreated += 1;
              if (result === "updated") counters.eventsUpdated += 1;
            }
          } catch {
            calendarObjectErrors += 1;
            errors.push({
              code: "CALENDAR_OBJECT_SYNC_FAILED",
              calendar: source.calendarName,
              objectRef,
              message: calendarObjectErrorMessage()
            });
            console.log(`Calendar object sync failed: ${source.calendarName}; objectRef=${objectRef}`);
          }
        }

        counters.eventsFetched += calendarFetched;
        const importedOrClean = calendarProcessedEvents > 0 || calendarObjectErrors === 0;
        const lastSyncStatus = calendarObjectErrors > 0 ? (calendarProcessedEvents > 0 ? "partial" : "failed") : "success";
        if (importedOrClean) syncedCalendarIds.push(source.id);
        await prisma.calendarSource.update({ where: { id: source.id }, data: { lastSyncAt: new Date(), lastSyncStatus } });
        console.log(`Calendar synced: ${source.calendarName}; events found: ${calendarFetched}; object errors: ${calendarObjectErrors}`);
      } catch (error) {
        await prisma.calendarSource.update({ where: { id: source.id }, data: { lastSyncAt: new Date(), lastSyncStatus: "failed" } });
        errors.push({ code: "CALENDAR_SYNC_FAILED", calendar: source.calendarName, message: error instanceof Error ? error.message : "Calendar sync failed" });
        console.log(`Calendar sync failed: ${source.calendarName}`);
      }
    }

    counters.eventsDeleted = await markDeletedICloudEvents({
      sourceCalendarIds: syncedCalendarIds,
      seenExternalIds: [...seenExternalIds],
      rangeStart: start,
      rangeEnd: end
    });
    console.log(`iCloud sync finished: fetched=${counters.eventsFetched}, created=${counters.eventsCreated}, updated=${counters.eventsUpdated}, deleted=${counters.eventsDeleted}`);
    return finishSyncLog({ logId: log.id, counters, errors, syncedCalendarIds });
  } catch (error) {
    console.log("iCloud sync failed before calendar import");
    const message = error instanceof Error ? error.message : "Unable to connect to iCloud CalDAV.";
    return prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        message: "iCloud CalDAV login or discovery failed.",
        eventsFetched: counters.eventsFetched,
        eventsCreated: counters.eventsCreated,
        eventsUpdated: counters.eventsUpdated,
        eventsDeleted: counters.eventsDeleted,
        errors: [{ code: "CALDAV_DISCOVERY_FAILED", message }]
      }
    });
  }
}

export const syncInternals = {
  syncWindow,
  markDeletedICloudEvents,
  upsertICloudEvent,
  calendarObjectReference
};
