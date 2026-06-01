import { describe, expect, it } from "vitest";
import { isRecurringTaskDueOnDate, parseTaskRecurrence } from "@/domain/tasks/recurrence";

describe("task recurrence", () => {
  it("shows daily tasks on every weekday and weekend day", () => {
    const recurrence = parseTaskRecurrence({ type: "daily" });

    expect(isRecurringTaskDueOnDate(recurrence, new Date("2026-06-01T12:00:00.000Z"))).toBe(true);
    expect(isRecurringTaskDueOnDate(recurrence, new Date("2026-06-07T12:00:00.000Z"))).toBe(true);
  });

  it("shows weekday tasks from Monday through Friday only", () => {
    const recurrence = parseTaskRecurrence({ type: "weekdays" });

    expect(isRecurringTaskDueOnDate(recurrence, new Date("2026-06-01T12:00:00.000Z"))).toBe(true);
    expect(isRecurringTaskDueOnDate(recurrence, new Date("2026-06-05T12:00:00.000Z"))).toBe(true);
    expect(isRecurringTaskDueOnDate(recurrence, new Date("2026-06-06T12:00:00.000Z"))).toBe(false);
    expect(isRecurringTaskDueOnDate(recurrence, new Date("2026-06-07T12:00:00.000Z"))).toBe(false);
  });

  it("shows weekly tasks only on selected ISO weekdays", () => {
    const recurrence = parseTaskRecurrence({ type: "weekly", days: [1, 3, 5] });

    expect(isRecurringTaskDueOnDate(recurrence, new Date("2026-06-01T12:00:00.000Z"))).toBe(true);
    expect(isRecurringTaskDueOnDate(recurrence, new Date("2026-06-02T12:00:00.000Z"))).toBe(false);
    expect(isRecurringTaskDueOnDate(recurrence, new Date("2026-06-03T12:00:00.000Z"))).toBe(true);
    expect(isRecurringTaskDueOnDate(recurrence, new Date("2026-06-05T12:00:00.000Z"))).toBe(true);
  });

  it("rejects malformed recurrence JSON", () => {
    expect(parseTaskRecurrence({ type: "weekly", days: [0, 8] })).toBeNull();
    expect(parseTaskRecurrence({ type: "monthly" })).toBeNull();
  });
});
