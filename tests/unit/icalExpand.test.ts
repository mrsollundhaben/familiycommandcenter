import ICAL from "ical.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expandICalendarEvents } from "@/server/services/icalExpand";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("expandICalendarEvents", () => {
  it("expands recurring events without exceptions", () => {
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:test-recurring\nDTSTART:20260530T080000Z\nDTEND:20260530T083000Z\nRRULE:FREQ=DAILY;COUNT=3\nSUMMARY:[FIX] Morgenroutine\nEND:VEVENT\nEND:VCALENDAR`;

    const events = expandICalendarEvents(ics, new Date("2026-05-31T00:00:00.000Z"), new Date("2026-06-01T23:59:59.000Z"));
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.uid)).toEqual(["test-recurring", "test-recurring"]);
  });

  it("expands recurring events with one RECURRENCE-ID exception", () => {
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:test-exception\nDTSTART:20260530T080000Z\nDTEND:20260530T083000Z\nRRULE:FREQ=DAILY;COUNT=2\nSUMMARY:Morgenroutine\nEND:VEVENT\nBEGIN:VEVENT\nUID:test-exception\nRECURRENCE-ID:20260531T080000Z\nDTSTART:20260531T090000Z\nDTEND:20260531T093000Z\nSUMMARY:Verschobene Morgenroutine\nEND:VEVENT\nEND:VCALENDAR`;

    const events = expandICalendarEvents(ics, new Date("2026-05-30T00:00:00.000Z"), new Date("2026-05-31T23:59:59.000Z"));
    expect(events).toHaveLength(2);
    expect(events.some((event) => event.title === "Verschobene Morgenroutine")).toBe(true);
  });

  it("does not crash recurring expansion with malformed exception data", () => {
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:test-malformed-exception\nDTSTART:20260530T080000Z\nDTEND:20260530T083000Z\nRRULE:FREQ=DAILY;COUNT=2\nSUMMARY:Morgenroutine\nEND:VEVENT\nBEGIN:VEVENT\nUID:test-malformed-exception\nRECURRENCE-ID:20260531T080000Z\nSUMMARY:Exception ohne DTSTART\nEND:VEVENT\nEND:VCALENDAR`;

    expect(() => expandICalendarEvents(ics, new Date("2026-05-30T00:00:00.000Z"), new Date("2026-05-31T23:59:59.000Z"))).not.toThrow();
    const events = expandICalendarEvents(ics, new Date("2026-05-30T00:00:00.000Z"), new Date("2026-05-31T23:59:59.000Z"));
    expect(events.length).toBeGreaterThan(0);
  });

  it("falls back when getOccurrenceDetails throws", () => {
    vi.spyOn(ICAL.Event.prototype, "getOccurrenceDetails").mockImplementation(() => {
      throw new Error("options.exceptions.forEach is not a function");
    });

    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:test-fallback\nDTSTART:20260530T080000Z\nDTEND:20260530T083000Z\nRRULE:FREQ=DAILY;COUNT=2\nSUMMARY:Morgenroutine\nEND:VEVENT\nEND:VCALENDAR`;

    expect(() => expandICalendarEvents(ics, new Date("2026-05-30T00:00:00.000Z"), new Date("2026-05-31T23:59:59.000Z"))).not.toThrow();
    const events = expandICalendarEvents(ics, new Date("2026-05-30T00:00:00.000Z"), new Date("2026-05-31T23:59:59.000Z"));
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe("Morgenroutine");
  });

  it("recognizes all-day events", () => {
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:test-all-day\nDTSTART;VALUE=DATE:20260530\nDTEND;VALUE=DATE:20260531\nSUMMARY:Feiertag\nEND:VEVENT\nEND:VCALENDAR`;

    const events = expandICalendarEvents(ics, new Date("2026-05-30T00:00:00.000Z"), new Date("2026-05-30T23:59:59.000Z"));
    expect(events).toHaveLength(1);
    expect(events[0].isAllDay).toBe(true);
  });
});
