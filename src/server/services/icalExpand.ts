import ICAL from "ical.js";
import type { ICloudOccurrence } from "@/domain/events/icloudMapping";

function warnICalendar(message: string, details: Record<string, unknown>) {
  console.warn(message, details);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function timeToDate(time: ICAL.Time) {
  return time.toJSDate();
}

function recurrenceIdFor(time: ICAL.Time) {
  return time.toString();
}

function cloneTime(time: ICAL.Time) {
  return ICAL.Time.fromJSDate(time.toJSDate(), time.isDate);
}

function addDuration(start: ICAL.Time, duration: ICAL.Duration | null | undefined) {
  const end = cloneTime(start);
  if (duration) end.addDuration(duration);
  return end;
}

function eventSummary(event: ICAL.Event) {
  return event.summary || "Ohne Titel";
}

function eventToOccurrence(event: ICAL.Event, recurrenceTime?: ICAL.Time): ICloudOccurrence {
  let startDate = recurrenceTime ?? event.startDate;
  let endDate = recurrenceTime ? addDuration(startDate, event.duration ?? null) : event.endDate;
  let item = event;

  if (recurrenceTime) {
    try {
      const details = event.getOccurrenceDetails(recurrenceTime);
      startDate = details?.startDate ?? recurrenceTime;
      endDate = details?.endDate ?? addDuration(startDate, event.duration ?? null);
      const detailItem = details?.item as ICAL.Event | ICAL.Component | undefined;
      item = detailItem instanceof ICAL.Event ? detailItem : detailItem ? new ICAL.Event(detailItem) : event;
    } catch (error) {
      warnICalendar("Failed to get iCalendar occurrence details; falling back to recurrence time.", {
        uid: event.uid,
        summary: eventSummary(event),
        recurrenceTime: recurrenceTime.toString(),
        message: errorMessage(error)
      });
      startDate = recurrenceTime;
      endDate = addDuration(startDate, event.duration ?? null);
      item = event;
    }
  }

  return {
    uid: item.uid || event.uid,
    recurrenceId: recurrenceTime ? recurrenceIdFor(recurrenceTime) : recurrenceIdFor(startDate),
    title: item.summary || event.summary || "Ohne Titel",
    description: item.description || null,
    location: item.location || null,
    startDateTime: timeToDate(startDate),
    endDateTime: endDate ? timeToDate(endDate) : null,
    isAllDay: startDate.isDate
  };
}

function overlapsWindow(occurrence: ICloudOccurrence, rangeStart: Date, rangeEnd: Date) {
  const start = occurrence.startDateTime.getTime();
  const end = occurrence.endDateTime?.getTime() ?? start;
  return start <= rangeEnd.getTime() && end >= rangeStart.getTime();
}

function isException(component: ICAL.Component) {
  return Boolean(component.getFirstPropertyValue("recurrence-id"));
}

function createEvent(component: ICAL.Component) {
  try {
    return new ICAL.Event(component);
  } catch (error) {
    warnICalendar("Failed to parse iCalendar VEVENT; skipping event.", {
      uid: component.getFirstPropertyValue("uid") ?? null,
      summary: component.getFirstPropertyValue("summary") ?? null,
      recurrenceTime: component.getFirstPropertyValue("recurrence-id")?.toString() ?? null,
      message: errorMessage(error)
    });
    return null;
  }
}

function exceptionKey(uid: string, recurrenceId: ICAL.Time | null | undefined) {
  return recurrenceId ? `${uid}:${recurrenceId.toString()}` : null;
}

function safeRelateException(master: ICAL.Event, exception: ICAL.Event) {
  const maybeMaster = master as unknown as { relateException?: (event: ICAL.Event) => void };
  if (typeof maybeMaster.relateException !== "function") return false;

  try {
    maybeMaster.relateException(exception);
    return true;
  } catch (error) {
    warnICalendar("Failed to relate iCalendar recurrence exception; continuing without exception relation.", {
      uid: exception.uid || master.uid,
      summary: exception.summary || master.summary || null,
      recurrenceTime: exception.recurrenceId?.toString() ?? null,
      message: errorMessage(error)
    });
    return false;
  }
}

function pushOccurrenceIfInWindow(occurrences: ICloudOccurrence[], event: ICAL.Event, rangeStart: Date, rangeEnd: Date, recurrenceTime?: ICAL.Time) {
  try {
    const occurrence = eventToOccurrence(event, recurrenceTime);
    if (overlapsWindow(occurrence, rangeStart, rangeEnd)) occurrences.push(occurrence);
    return occurrence;
  } catch (error) {
    warnICalendar("Failed to expand iCalendar event occurrence; skipping occurrence.", {
      uid: event.uid,
      summary: eventSummary(event),
      recurrenceTime: recurrenceTime?.toString() ?? null,
      message: errorMessage(error)
    });
    return null;
  }
}

function pushExceptionOccurrenceIfInWindow(occurrences: ICloudOccurrence[], exception: ICAL.Event, recurrenceTime: ICAL.Time, rangeStart: Date, rangeEnd: Date) {
  try {
    const occurrence = eventToOccurrence(exception);
    occurrence.recurrenceId = recurrenceIdFor(recurrenceTime);
    if (overlapsWindow(occurrence, rangeStart, rangeEnd)) occurrences.push(occurrence);
    return true;
  } catch (error) {
    warnICalendar("Failed to expand iCalendar recurrence exception; falling back to master occurrence.", {
      uid: exception.uid,
      summary: eventSummary(exception),
      recurrenceTime: recurrenceTime.toString(),
      message: errorMessage(error)
    });
    return false;
  }
}

function expandRecurringEvent(
  event: ICAL.Event,
  occurrences: ICloudOccurrence[],
  rangeStart: Date,
  rangeEnd: Date,
  exceptionsByRecurrenceId: Map<string, ICAL.Event>
) {
  let iterator: ICAL.RecurExpansion;
  try {
    iterator = event.iterator();
  } catch (error) {
    warnICalendar("Failed to create iCalendar recurrence iterator; skipping event.", {
      uid: event.uid,
      summary: eventSummary(event),
      message: errorMessage(error)
    });
    return;
  }

  let guard = 0;
  while (guard < 1000) {
    let next: ICAL.Time | null;
    try {
      next = iterator.next();
    } catch (error) {
      warnICalendar("Failed to advance iCalendar recurrence iterator; stopping event expansion.", {
        uid: event.uid,
        summary: eventSummary(event),
        message: errorMessage(error)
      });
      return;
    }

    if (!next) return;
    const key = exceptionKey(event.uid, next);
    const exception = key ? exceptionsByRecurrenceId.get(key) : undefined;
    const occurrence = exception && pushExceptionOccurrenceIfInWindow(occurrences, exception, next, rangeStart, rangeEnd)
      ? null
      : pushOccurrenceIfInWindow(occurrences, event, rangeStart, rangeEnd, next);
    if (occurrence && occurrence.startDateTime.getTime() > rangeEnd.getTime()) return;
    if (!occurrence && next.toJSDate().getTime() > rangeEnd.getTime()) return;
    guard += 1;
  }

  warnICalendar("Stopped iCalendar recurrence expansion after safety limit.", {
    uid: event.uid,
    summary: eventSummary(event),
    limit: 1000
  });
}

export function expandICalendarEvents(ics: string, rangeStart: Date, rangeEnd: Date): ICloudOccurrence[] {
  let calendar: ICAL.Component;
  try {
    const parsed = ICAL.parse(ics);
    calendar = new ICAL.Component(parsed);
  } catch (error) {
    warnICalendar("Failed to parse iCalendar object; skipping calendar object.", { message: errorMessage(error) });
    return [];
  }

  const components = calendar.getAllSubcomponents("vevent");
  const masterComponents = components.filter((component) => !isException(component));
  const exceptionComponents = components.filter(isException);
  const masters = masterComponents.map(createEvent).filter((event): event is ICAL.Event => Boolean(event));
  const exceptions = exceptionComponents.map(createEvent).filter((event): event is ICAL.Event => Boolean(event));

  const exceptionsByRecurrenceId = new Map<string, ICAL.Event>();
  for (const exception of exceptions) {
    const key = exceptionKey(exception.uid, exception.recurrenceId);
    if (key) exceptionsByRecurrenceId.set(key, exception);
    const master = masters.find((event) => event.uid === exception.uid);
    if (master) safeRelateException(master, exception);
  }

  const occurrences: ICloudOccurrence[] = [];
  for (const event of masters) {
    try {
      if (event.isRecurring()) {
        expandRecurringEvent(event, occurrences, rangeStart, rangeEnd, exceptionsByRecurrenceId);
      } else {
        pushOccurrenceIfInWindow(occurrences, event, rangeStart, rangeEnd);
      }
    } catch (error) {
      warnICalendar("Failed to process iCalendar event; skipping event.", {
        uid: event.uid,
        summary: eventSummary(event),
        message: errorMessage(error)
      });
    }
  }

  for (const exception of exceptions) {
    if (!masters.some((master) => master.uid === exception.uid)) {
      pushOccurrenceIfInWindow(occurrences, exception, rangeStart, rangeEnd, exception.recurrenceId ?? undefined);
    }
  }

  return occurrences;
}

export const icalExpandInternals = {
  eventToOccurrence,
  safeRelateException
};
