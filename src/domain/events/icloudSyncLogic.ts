export function hasICloudCredentials(input: { username?: string; appPassword?: string }) {
  return Boolean(input.username && input.appPassword);
}

export function classifyICloudUpsert(existing: { rawHash: string | null; deletedAt: Date | null } | null, nextRawHash: string) {
  if (!existing) return "created" as const;
  if (existing.rawHash !== nextRawHash || existing.deletedAt) return "updated" as const;
  return "unchanged" as const;
}

export function getSyncCompletionStatus(input: { errorCount: number; syncedCalendarCount: number }) {
  return input.errorCount === 0 ? "success" : input.syncedCalendarCount > 0 ? "partial" : "failed";
}
