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
  completionDate?: string;
  isAllDay?: boolean;
  personIds: string[];
  rigidity: Rigidity;
  category: EventCategory;
  importance: Importance;
  preparationNotes?: string | null;
  leaveAt?: string | null;
  prepareAt?: string | null;
  preparationChecklist?: string[];
  location?: string | null;
  isDone: boolean;
};

export type DashboardDaySection = {
  date: string;
  label: string;
  dayOffset: number;
  items: DashboardItem[];
  totalItemCount: number;
  hiddenItemCount: number;
  isLimited: boolean;
};

export type DashboardToday = {
  date: string;
  timezone: string;
  now: string;
  sync: { lastSyncAt: string | null; status: string | null; isStale: boolean };
  current: DashboardItem | null;
  next: (DashboardItem & { countdownMinutes: number }) | null;
  sections: {
    allDay: DashboardItem[];
    later: DashboardItem[];
    tasks: DashboardItem[];
    days: DashboardDaySection[];
  };
  familyMembers: DashboardPerson[];
};
