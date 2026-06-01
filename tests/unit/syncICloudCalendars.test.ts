import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    syncLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    calendarSource: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    familyMember: {
      findMany: vi.fn()
    },
    familyEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn()
    },
    familyEventPerson: {
      deleteMany: vi.fn(),
      createMany: vi.fn()
    }
  };

  return {
    prisma,
    getEnv: vi.fn(),
    createDAVClient: vi.fn(),
    fetchCalendars: vi.fn(),
    fetchCalendarObjects: vi.fn()
  };
});

vi.mock("@/server/config/env", () => ({
  getEnv: mocks.getEnv
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: mocks.prisma
}));

vi.mock("tsdav", () => ({
  createDAVClient: mocks.createDAVClient
}));

const calendar = {
  url: "https://caldav.example.test/calendars/family/",
  displayName: "Familie",
  calendarColor: "#123456",
  components: ["VEVENT"]
};

const calendarSource = {
  id: "calendar-source-1",
  name: "Familie",
  caldavUrl: calendar.url,
  calendarName: "Familie",
  calendarColor: "#123456",
  enabled: true,
  defaultRigidity: "flexible",
  defaultCategory: "appointment",
  defaultPersonIds: null
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  mocks.getEnv.mockReturnValue({
    ICLOUD_USERNAME: "user@example.test",
    ICLOUD_APP_PASSWORD: "app-password",
    CALDAV_URL: "https://caldav.example.test",
    DEFAULT_TIMEZONE: "UTC",
    SYNC_DAYS_AHEAD: 3
  });
  mocks.fetchCalendars.mockResolvedValue([calendar]);
  mocks.fetchCalendarObjects.mockResolvedValue([]);
  mocks.createDAVClient.mockResolvedValue({
    fetchCalendars: mocks.fetchCalendars,
    fetchCalendarObjects: mocks.fetchCalendarObjects
  });

  mocks.prisma.syncLog.findFirst.mockResolvedValue(null);
  mocks.prisma.syncLog.create.mockResolvedValue({ id: "sync-log-1" });
  mocks.prisma.syncLog.update.mockImplementation(async ({ data }) => ({ id: "sync-log-1", ...data }));
  mocks.prisma.calendarSource.findMany.mockResolvedValue([calendarSource]);
  mocks.prisma.calendarSource.create.mockResolvedValue(calendarSource);
  mocks.prisma.calendarSource.update.mockResolvedValue(calendarSource);
  mocks.prisma.familyMember.findMany.mockResolvedValue([]);
  mocks.prisma.familyEvent.findFirst.mockResolvedValue(null);
  mocks.prisma.familyEvent.create.mockResolvedValue({ id: "event-1" });
  mocks.prisma.familyEvent.update.mockResolvedValue({ id: "event-1" });
  mocks.prisma.familyEvent.findMany.mockResolvedValue([]);
  mocks.prisma.familyEvent.updateMany.mockResolvedValue({ count: 0 });
  mocks.prisma.familyEventPerson.deleteMany.mockResolvedValue({ count: 0 });
  mocks.prisma.familyEventPerson.createMany.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("syncICloudCalendars", () => {
  it("records a malformed iCalendar object error and continues importing valid objects", async () => {
    const brokenPrivateObject = {
      url: "https://caldav.example.test/calendars/family/broken-private.ics",
      data: "BROKEN PRIVATE TITLE THAT MUST NOT BE STORED IN ERRORS"
    };
    const validPrivateObject = {
      url: "https://caldav.example.test/calendars/family/valid-private.ics",
      data: `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:valid-1\nDTSTART:20260601T100000Z\nDTEND:20260601T110000Z\nSUMMARY:Private Valid Title\nDESCRIPTION:Private Valid Description\nEND:VEVENT\nEND:VCALENDAR`
    };
    mocks.fetchCalendarObjects.mockResolvedValue([brokenPrivateObject, validPrivateObject]);

    const { syncICloudCalendars } = await import("@/server/services/syncICloudCalendars");
    const result = await syncICloudCalendars();

    expect(result.status).toBe("partial");
    expect(result.eventsFetched).toBe(1);
    expect(result.eventsCreated).toBe(1);
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: "CALENDAR_OBJECT_SYNC_FAILED",
        calendar: "Familie",
        message: "Failed to process iCalendar object.",
        objectRef: expect.stringMatching(/^sha256:[a-f0-9]{16}$/)
      })
    ]);
    expect(JSON.stringify(result.errors)).not.toContain("PRIVATE TITLE");
    expect(JSON.stringify(result.errors)).not.toContain("Private Valid Title");
    expect(mocks.prisma.familyEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Private Valid Title",
        description: "Private Valid Description",
        sourceCalendarId: "calendar-source-1"
      })
    });
    expect(mocks.prisma.calendarSource.update).toHaveBeenCalledWith({
      where: { id: "calendar-source-1" },
      data: expect.objectContaining({ lastSyncStatus: "partial" })
    });
  });
});
