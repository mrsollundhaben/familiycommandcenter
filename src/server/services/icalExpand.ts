import ICAL from "ical.js";
import type { ICloudOccurrence } from "@/domain/events/icloudMapping";

function timeToDate(time: ICAL.Time) {
  return time.toJSDate();
}

function recurrenceIdFor(time: ICAL.Time) {
  return time.toString();
}

function eventToOccurrence(event: ICAL.Event, recurrenceTime?: ICAL.Time): ICloudOccurrence {
  const details = recurrenceTime ? event.getOccurrenceDetails(recurrenceTime) : undefined;
  const startDate = details?.startDate ?? event.startDate;
  const endDate = details?.endDate ?? event.endDate;
  const item = details?.item ? new ICAL.Event(details.item) : event;

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

function safeRelateException(master: ICAL.Event, exception: ICAL.Event) {
  const maybeMaster = master as unknown as { relateException?: (event: ICAL.Event) => void };
  if (typeof maybeMaster.relateException === "function") {
    maybeMaster.relateException(exception);
    return true;
  }
  return false;
}

export function expandICalendarEvents(ics: string, rangeStart: Date, rangeEnd: Date): ICloudOccurrence[] {
  const parsed = ICAL.parse(ics);
  const calendar = new ICAL.Component(parsed);
  const components = calendar.getAllSubcomponents("vevent");
  const masters = components.filter((component) => !isException(component)).map((component) => new ICAL.Event(component));
  const exceptions = components.filter(isException).map((component) => new ICAL.Event(component));

  for (const exception of exceptions) {
    const master = masters.find((event) => event.uid === exception.uid);
    if (master) safeRelateException(master, exception);
  }

  const occurrences: ICloudOccurrence[] = [];
  for (const event of masters) {
    if (event.isRecurring()) {
      const iterator = event.iterator(ICAL.Time.fromJSDate(rangeStart));
      let next = iterator.next();
      let guard = 0;
      while (next && guard < 1000) {
        const occurrence = eventToOccurrence(event, next);
        if (occurrence.startDateTime.getTime() > rangeEnd.getTime()) break;
        if (overlapsWindow(occurrence, rangeStart, rangeEnd)) occurrences.push(occurrence);
        next = iterator.next();
        guard += 1;
      }
    } else {
      const occurrence = eventToOccurrence(event);
      if (overlapsWindow(occurrence, rangeStart, rangeEnd)) occurrences.push(occurrence);
    }
  }

  for (const exception of exceptions) {
    if (!masters.some((master) => master.uid === exception.uid)) {
      const occurrence = eventToOccurrence(exception, exception.recurrenceId ?? undefined);
      if (overlapsWindow(occurrence, rangeStart, rangeEnd)) occurrences.push(occurrence);
    }
  }

  return occurrences;
}
