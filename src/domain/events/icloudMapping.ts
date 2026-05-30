import { createHash } from "crypto";
import type { EventCategory, Importance, Rigidity } from "@/domain/events/valueTypes";
import { parseFamilyTags } from "@/domain/tags/parseTags";

type MemberLike = {
  id: string;
  displayName: string;
  shortName: string;
};

type CalendarSourceLike = {
  id: string;
  defaultRigidity: string;
  defaultCategory: string;
  defaultPersonIds: unknown;
};

export type ICloudOccurrence = {
  uid: string;
  recurrenceId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDateTime: Date;
  endDateTime?: Date | null;
  isAllDay: boolean;
};

export type NormalizedICloudEvent = {
  externalId: string;
  recurrenceId: string;
  title: string;
  originalTitle: string;
  description?: string | null;
  location?: string | null;
  startDateTime: Date;
  endDateTime?: Date | null;
  isAllDay: boolean;
  personIds: string[];
  rigidity: Rigidity;
  category: EventCategory;
  importance: Importance;
  preparationNotes?: string | null;
  rawHash: string;
};

const personTagAliases: Record<string, string[]> = {
  MAMA: ["mama", "mutter"],
  PAPA: ["papa", "vater"],
  KIND1: ["kind1", "kind 1", "k1"],
  KIND2: ["kind2", "kind 2", "k2"],
  KIND3: ["kind3", "kind 3", "k3"],
  KIND4: ["kind4", "kind 4", "k4"]
};

function normalizeLookup(value: string) {
  return value.toLocaleLowerCase("de-AT").replace(/[^a-z0-9äöüß]/g, "");
}

function isRigidity(value: string): value is Rigidity {
  return value === "fixed" || value === "flexible" || value === "optional";
}

function isCategory(value: string): value is EventCategory {
  return value === "appointment" || value === "task" || value === "routine" || value === "reminder";
}

function defaultPersonIds(defaultPersonIds: unknown): string[] {
  return Array.isArray(defaultPersonIds) ? defaultPersonIds.filter((id): id is string => typeof id === "string") : [];
}

export function buildICloudExternalId(input: { calendarId: string; uid: string; recurrenceId: string }) {
  return ["icloud", input.calendarId, input.uid, input.recurrenceId].map((part) => encodeURIComponent(part)).join(":");
}

export function buildRawEventHash(input: Omit<NormalizedICloudEvent, "rawHash" | "personIds"> & { personIds: string[] }) {
  return createHash("sha256")
    .update(JSON.stringify({
      title: input.title,
      originalTitle: input.originalTitle,
      description: input.description ?? null,
      location: input.location ?? null,
      startDateTime: input.startDateTime.toISOString(),
      endDateTime: input.endDateTime?.toISOString() ?? null,
      isAllDay: input.isAllDay,
      personIds: input.personIds,
      rigidity: input.rigidity,
      category: input.category,
      importance: input.importance,
      preparationNotes: input.preparationNotes ?? null
    }))
    .digest("hex");
}

export function mapPersonTags(input: { personKeys: string[]; appliesToAll: boolean; members: MemberLike[]; calendarSource: CalendarSourceLike }) {
  if (input.appliesToAll) return input.members.map((member) => member.id);

  const lookup = new Map<string, string>();
  for (const member of input.members) {
    lookup.set(normalizeLookup(member.id), member.id);
    lookup.set(normalizeLookup(member.shortName), member.id);
    lookup.set(normalizeLookup(member.displayName), member.id);
  }

  const mapped = new Set<string>();
  for (const key of input.personKeys) {
    for (const alias of personTagAliases[key] ?? [key]) {
      const memberId = lookup.get(normalizeLookup(alias));
      if (memberId) mapped.add(memberId);
    }
  }

  if (mapped.size > 0) return [...mapped];
  return defaultPersonIds(input.calendarSource.defaultPersonIds);
}

export function normalizeICloudOccurrence(input: { occurrence: ICloudOccurrence; calendarSource: CalendarSourceLike; members: MemberLike[] }) {
  const parsed = parseFamilyTags({ title: input.occurrence.title, description: input.occurrence.description });
  const personIds = mapPersonTags({
    personKeys: parsed.personKeys,
    appliesToAll: parsed.appliesToAll,
    members: input.members,
    calendarSource: input.calendarSource
  });
  const fallbackRigidity = isRigidity(input.calendarSource.defaultRigidity) ? input.calendarSource.defaultRigidity : "flexible";
  const fallbackCategory = isCategory(input.calendarSource.defaultCategory) ? input.calendarSource.defaultCategory : "appointment";
  const normalizedWithoutHash = {
    externalId: buildICloudExternalId({ calendarId: input.calendarSource.id, uid: input.occurrence.uid, recurrenceId: input.occurrence.recurrenceId }),
    recurrenceId: input.occurrence.recurrenceId,
    title: parsed.cleanTitle || input.occurrence.title,
    originalTitle: input.occurrence.title,
    description: input.occurrence.description ?? null,
    location: input.occurrence.location ?? null,
    startDateTime: input.occurrence.startDateTime,
    endDateTime: input.occurrence.endDateTime ?? null,
    isAllDay: input.occurrence.isAllDay,
    personIds,
    rigidity: parsed.rigidity ?? fallbackRigidity,
    category: parsed.category ?? fallbackCategory,
    importance: parsed.importance ?? "normal",
    preparationNotes: parsed.preparationNotes ?? null
  } satisfies Omit<NormalizedICloudEvent, "rawHash">;

  return {
    ...normalizedWithoutHash,
    rawHash: buildRawEventHash(normalizedWithoutHash)
  };
}
