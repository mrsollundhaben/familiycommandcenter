import { describe, expect, it } from "vitest";
import { expandICalendarEvents } from "@/server/services/icalExpand";

describe("expandICalendarEvents", () => {
  it("expands recurring events within the sync window", () => {
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:test-recurring\nDTSTART:20260530T080000Z\nDTEND:20260530T083000Z\nRRULE:FREQ=DAILY;COUNT=3\nSUMMARY:[FIX] Morgenroutine\nEND:VEVENT\nEND:VCALENDAR`;

    const events = expandICalendarEvents(ics, new Date("2026-05-31T00:00:00.000Z"), new Date("2026-06-01T23:59:59.000Z"));
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.uid)).toEqual(["test-recurring", "test-recurring"]);
  });

  it("recognizes all-day events", () => {
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:test-all-day\nDTSTART;VALUE=DATE:20260530\nDTEND;VALUE=DATE:20260531\nSUMMARY:Feiertag\nEND:VEVENT\nEND:VCALENDAR`;

    const events = expandICalendarEvents(ics, new Date("2026-05-30T00:00:00.000Z"), new Date("2026-05-30T23:59:59.000Z"));
    expect(events).toHaveLength(1);
    expect(events[0].isAllDay).toBe(true);
  });
});
