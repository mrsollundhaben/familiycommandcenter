import { startSyncScheduler } from "@/server/services/syncScheduler";

export function bootstrapSyncScheduler() {
  return startSyncScheduler();
}
