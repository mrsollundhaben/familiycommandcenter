import { describe, expect, it } from "vitest";
import { buildICloudExternalId, normalizeICloudOccurrence } from "@/domain/events/icloudMapping";
import { classifyICloudUpsert, getSyncCompletionStatus, hasICloudCredentials } from "@/domain/events/icloudSyncLogic";

const members = [
  { id: "mama", displayName: "Mama", shortName: "Mama" },
  { id: "papa", displayName: "Papa", shortName: "Papa" },
  { id: "k1", displayName: "Kind 1", shortName: "K1" },
  { id: "k2", displayName: "Kind 2", shortName: "K2" }
];

const calendarSource = {
  id: "calendar-1",
  defaultRigidity: "flexible",
  defaultCategory: "appointment",
  defaultPersonIds: ["mama"]
};

describe("iCloud event mapping", () => {
  it("builds stable encoded external ids", () => {
    expect(buildICloudExternalId({ calendarId: "cal/1", uid: "uid@example.com", recurrenceId: "20260530T080000" }))
      .toBe("icloud:cal%2F1:uid%40example.com:20260530T080000");
  });

  it("normalizes tags, title, people, defaults and hash", () => {
    const event = normalizeICloudOccurrence({
      calendarSource,
      members,
      occurrence: {
        uid: "uid-1",
        recurrenceId: "20260530T150000",
        title: "[FIX] [KIND1] Fußball [WICHTIG]",
        description: "Bitte [PACKEN]",
        location: "Sportplatz",
        startDateTime: new Date("2026-05-30T15:00:00.000Z"),
        endDateTime: new Date("2026-05-30T16:00:00.000Z"),
        isAllDay: false
      }
    });

    expect(event.title).toBe("Fußball");
    expect(event.rigidity).toBe("fixed");
    expect(event.category).toBe("appointment");
    expect(event.importance).toBe("important");
    expect(event.personIds).toEqual(["k1"]);
    expect(event.preparationNotes).toBe("Tasche packen");
    expect(event.rawHash).toHaveLength(64);
  });

  it("uses CalendarSource default people when no person tag exists", () => {
    const event = normalizeICloudOccurrence({
      calendarSource,
      members,
      occurrence: {
        uid: "uid-2",
        recurrenceId: "20260530T090000",
        title: "[FLEX] Einkauf",
        startDateTime: new Date("2026-05-30T09:00:00.000Z"),
        endDateTime: null,
        isAllDay: false
      }
    });

    expect(event.personIds).toEqual(["mama"]);
  });

  it("detects missing credentials", () => {
    expect(hasICloudCredentials({ username: "user@example.com", appPassword: "app-pass" })).toBe(true);
    expect(hasICloudCredentials({ username: "user@example.com" })).toBe(false);
    expect(hasICloudCredentials({ appPassword: "app-pass" })).toBe(false);
    expect(hasICloudCredentials({ username: "   ", appPassword: "app-pass" })).toBe(false);
  });

  it("classifies upsert decisions", () => {
    expect(classifyICloudUpsert(null, "hash-a")).toBe("created");
    expect(classifyICloudUpsert({ rawHash: "hash-a", deletedAt: null }, "hash-a")).toBe("unchanged");
    expect(classifyICloudUpsert({ rawHash: "hash-a", deletedAt: null }, "hash-b")).toBe("updated");
    expect(classifyICloudUpsert({ rawHash: "hash-a", deletedAt: new Date("2026-05-30T00:00:00.000Z") }, "hash-a")).toBe("updated");
  });

  it("derives sync completion status", () => {
    expect(getSyncCompletionStatus({ errorCount: 0, syncedCalendarCount: 2 })).toBe("success");
    expect(getSyncCompletionStatus({ errorCount: 1, syncedCalendarCount: 2 })).toBe("partial");
    expect(getSyncCompletionStatus({ errorCount: 1, syncedCalendarCount: 0 })).toBe("failed");
  });
});
