import type { EventCategory, Importance, Rigidity } from "@/domain/events/valueTypes";

export type DashboardPerson = {
  id: string;
  displayName: string;
  shortName: string;
  color: string;
  icon: string | null;
};

export type DashboardItem = {
  id: string;
  kind: "event" | "task";
  title: string;
  startDateTime?: string;
  endDateTime?: string | null;
  dueDateTime?: string | null;
  isAllDay?: boolean;
  personIds: string[];
  rigidity: Rigidity;
  category: EventCategory;
  importance: Importance;
  preparationNotes?: string | null;
  location?: string | null;
  isDone: boolean;
};

export type DashboardToday = {
  date: string;
  timezone: string;
  now: string;
  sync: { lastSyncAt: string | null; status: string | null; isStale: boolean };
  current: DashboardItem | null;
  next: (DashboardItem & { countdownMinutes: number; countdownLabel: string }) | null;
  sections: { allDay: DashboardItem[]; later: DashboardItem[]; tasks: DashboardItem[] };
  familyMembers: DashboardPerson[];
};
