import type { EventCategory, Importance, Rigidity } from "@/domain/events/valueTypes";

export const rigidityTags: Record<string, Rigidity> = {
  FIX: "fixed",
  FIXED: "fixed",
  FLEX: "flexible",
  FLEXIBLE: "flexible",
  OPTIONAL: "optional",
  OPTION: "optional"
};

export const categoryTags: Record<string, EventCategory> = {
  TODO: "task",
  AUFGABE: "task",
  TASK: "task",
  ROUTINE: "routine",
  REMINDER: "reminder",
  ERINNERUNG: "reminder"
};

export const importanceTags: Record<string, Importance> = {
  WICHTIG: "important",
  IMPORTANT: "important",
  KRITISCH: "critical",
  CRITICAL: "critical"
};

export const personTags = new Set(["ALLE", "MAMA", "PAPA", "KIND1", "KIND2", "KIND3", "KIND4"]);
export const preparationTags = new Set(["PACKEN", "MITNEHMEN", "TASCHE"]);

export const knownTags = new Set([
  ...Object.keys(rigidityTags),
  ...Object.keys(categoryTags),
  ...Object.keys(importanceTags),
  ...personTags,
  ...preparationTags
]);
