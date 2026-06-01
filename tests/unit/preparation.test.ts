import { describe, expect, it } from "vitest";
import { buildPreparationHints, needsPreparationHints } from "@/domain/events/preparation";

describe("preparation hints", () => {
  it("builds default preparation and leave times for appointments with a location", () => {
    const hints = buildPreparationHints(
      {
        startDateTime: "2026-06-01T10:00:00.000Z",
        location: "Turnhalle"
      },
      new Date("2026-06-01T09:40:00.000Z")
    );

    expect(hints).toEqual({
      prepareAt: "2026-06-01T09:45:00.000Z",
      leaveAt: "2026-06-01T09:55:00.000Z",
      preparationChecklist: ["Tasche packen", "Schuhe anziehen", "Losgehen in 15 Minuten"]
    });
  });

  it("builds hints for PACKEN notes even without a location", () => {
    expect(needsPreparationHints({
      startDateTime: "2026-06-01T10:00:00.000Z",
      preparationNotes: "Tasche packen"
    })).toBe(true);
  });

  it("skips all-day appointments", () => {
    expect(buildPreparationHints({
      startDateTime: "2026-06-01T10:00:00.000Z",
      isAllDay: true,
      location: "Schule"
    })).toBeNull();
  });
});
