import { z } from "zod";

export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type IsoWeekday = typeof ISO_WEEKDAYS[number];

export const taskRecurrenceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("daily") }).strict(),
  z.object({ type: z.literal("weekdays") }).strict(),
  z.object({
    type: z.literal("weekly"),
    days: z.array(z.number().int().min(1).max(7)).min(1)
  }).strict()
]);

export type TaskRecurrence = z.infer<typeof taskRecurrenceSchema>;

export function parseTaskRecurrence(value: unknown): TaskRecurrence | null {
  if (value === null || value === undefined) return null;
  const result = taskRecurrenceSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function isoWeekday(date: Date): IsoWeekday {
  const day = date.getDay();
  return (day === 0 ? 7 : day) as IsoWeekday;
}

export function isRecurringTaskDueOnDate(recurrence: TaskRecurrence | null, date: Date) {
  if (!recurrence) return false;

  const weekday = isoWeekday(date);
  if (recurrence.type === "daily") return true;
  if (recurrence.type === "weekdays") return weekday >= 1 && weekday <= 5;
  return recurrence.days.includes(weekday);
}
