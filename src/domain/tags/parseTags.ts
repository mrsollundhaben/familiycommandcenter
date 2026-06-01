import type { EventCategory, Importance, Rigidity } from "@/domain/events/valueTypes";
import { categoryTags, importanceTags, knownTags, personTags, preparationTags, rigidityTags } from "./tagRules";

const tagRegex = /\[([A-ZÄÖÜ0-9_-]+)\]/gi;
const rigidityPriority: Rigidity[] = ["optional", "flexible", "fixed"];

export type ParsedTags = {
  cleanTitle: string;
  tags: string[];
  unknownTags: string[];
  personKeys: string[];
  appliesToAll: boolean;
  rigidity?: Rigidity;
  category?: EventCategory;
  importance?: Importance;
  preparationTags: string[];
  needsPackingPreparation: boolean;
  preparationNotes?: string;
};

function normalizeTag(tag: string) {
  return tag.trim().toUpperCase();
}

function extractTags(text: string | null | undefined) {
  if (!text) return [];
  return [...text.matchAll(tagRegex)].map((match) => normalizeTag(match[1]));
}

function cleanTitle(title: string) {
  return title.replace(tagRegex, " ").replace(/!\s*$/, " ").replace(/\s+/g, " ").trim();
}

function pickRigidity(tags: string[]): Rigidity | undefined {
  return tags.reduce<Rigidity | undefined>((current, tag) => {
    const next = rigidityTags[tag];
    if (!next) return current;
    if (!current) return next;
    return rigidityPriority.indexOf(next) > rigidityPriority.indexOf(current) ? next : current;
  }, undefined);
}

function pickCategory(tags: string[]): EventCategory | undefined {
  return tags.map((tag) => categoryTags[tag]).find(Boolean);
}

function pickImportance(tags: string[], title: string): Importance | undefined {
  const taggedImportance = tags.map((tag) => importanceTags[tag]).find(Boolean);
  if (taggedImportance) return taggedImportance;
  if (/!\s*$/.test(title)) return "important";
  return undefined;
}

export function parseFamilyTags(input: { title: string; description?: string | null }): ParsedTags {
  const tags = [...new Set([...extractTags(input.title), ...extractTags(input.description)])];
  const unknownTags = tags.filter((tag) => !knownTags.has(tag));
  const personKeys = tags.filter((tag) => personTags.has(tag) && tag !== "ALLE");
  const appliesToAll = tags.includes("ALLE");
  const prepTags = tags.filter((tag) => preparationTags.has(tag));
  const needsPackingPreparation = prepTags.includes("PACKEN");

  return {
    cleanTitle: cleanTitle(input.title),
    tags,
    unknownTags,
    personKeys,
    appliesToAll,
    rigidity: pickRigidity(tags),
    category: pickCategory(tags),
    importance: pickImportance(tags, input.title),
    preparationTags: prepTags,
    needsPackingPreparation,
    preparationNotes: prepTags.length ? prepTags.map((tag) => (tag === "PACKEN" ? "Tasche packen" : tag)).join(", ") : undefined
  };
}
