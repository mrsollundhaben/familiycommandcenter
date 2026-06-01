import { minutesUntil } from "./grouping";

export const DEFAULT_PREPARATION_LEAD_MINUTES = 15;
export const DEFAULT_LEAVE_LEAD_MINUTES = 5;

const PACKING_NOTE_PATTERN = /pack|tasche|mitnehmen/i;

type PreparationInput = {
  startDateTime?: string | Date | null;
  isAllDay?: boolean | null;
  location?: string | null;
  preparationNotes?: string | null;
};

export type PreparationHints = {
  leaveAt: string;
  prepareAt: string;
  preparationChecklist: string[];
};

export function hasPackingPreparation(preparationNotes?: string | null) {
  return PACKING_NOTE_PATTERN.test(preparationNotes ?? "");
}

export function needsPreparationHints(input: PreparationInput) {
  if (!input.startDateTime || input.isAllDay) return false;
  return Boolean(input.location?.trim()) || hasPackingPreparation(input.preparationNotes);
}

export function buildPreparationHints(input: PreparationInput, now = new Date()): PreparationHints | null {
  if (!needsPreparationHints(input)) return null;

  const startDateTime = new Date(input.startDateTime!);
  const prepareAt = new Date(startDateTime.getTime() - DEFAULT_PREPARATION_LEAD_MINUTES * 60000);
  const leaveAt = new Date(startDateTime.getTime() - DEFAULT_LEAVE_LEAD_MINUTES * 60000);

  return {
    leaveAt: leaveAt.toISOString(),
    prepareAt: prepareAt.toISOString(),
    preparationChecklist: [
      "Tasche packen",
      "Schuhe anziehen",
      `Losgehen in ${minutesUntil(leaveAt.toISOString(), now)} Minuten`
    ]
  };
}
