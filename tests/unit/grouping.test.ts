import { describe, expect, it } from "vitest";
import { findNext, formatCountdown, minutesUntil } from "@/domain/events/grouping";
import type { DashboardItem } from "@/domain/events/types";

function item(input: Partial<DashboardItem> & Pick<DashboardItem, "id" | "title" | "startDateTime" | "rigidity">): DashboardItem {
  return {
    kind: "event",
    category: "appointment",
    importance: "normal",
    personIds: [],
    isDone: false,
    ...input
  };
}

describe("dashboard grouping", () => {
  it("returns the chronologically next event even if a later fixed event exists", () => {
    const now = new Date("2026-06-01T08:00:00.000Z");
    const next = findNext([
      item({ id: "fixed-later", title: "Training", startDateTime: "2026-06-01T12:00:00.000Z", rigidity: "fixed" }),
      item({ id: "flex-sooner", title: "Hausübung", startDateTime: "2026-06-01T09:00:00.000Z", rigidity: "flexible" }),
      item({ id: "optional-sooner", title: "Spielplatz", startDateTime: "2026-06-01T10:00:00.000Z", rigidity: "optional" })
    ], now);

    expect(next?.id).toBe("flex-sooner");
  });

  it("skips done and all-day items when looking for the next event", () => {
    const now = new Date("2026-06-01T08:00:00.000Z");
    const next = findNext([
      item({ id: "all-day", title: "Feiertag", startDateTime: "2026-06-01T08:30:00.000Z", rigidity: "fixed", isAllDay: true }),
      item({ id: "done", title: "Erledigt", startDateTime: "2026-06-01T08:45:00.000Z", rigidity: "fixed", isDone: true }),
      item({ id: "actual", title: "Musik", startDateTime: "2026-06-01T09:00:00.000Z", rigidity: "optional" })
    ], now);

    expect(next?.id).toBe("actual");
  });

  it("formats countdowns as minutes below one hour", () => {
    expect(formatCountdown(45)).toBe("45 Minuten");
  });

  it("formats countdowns as hours and minutes", () => {
    expect(formatCountdown(125)).toBe("2 Stunden 5 Minuten");
    expect(formatCountdown(120)).toBe("2 Stunden");
    expect(formatCountdown(60)).toBe("1 Stunde");
    expect(formatCountdown(61)).toBe("1 Stunde 1 Minute");
  });

  it("calculates minutes until a future timestamp", () => {
    expect(minutesUntil("2026-06-01T09:30:00.000Z", new Date("2026-06-01T08:00:00.000Z"))).toBe(90);
  });
});
