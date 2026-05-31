import cron from "node-cron";
import { prisma } from "@/server/db/prisma";
import { getEnv } from "@/server/config/env";
import { syncICloudCalendars } from "@/server/services/syncICloudCalendars";

const DEFAULT_SYNC_INTERVAL_MINUTES = 10;

type SchedulerState = {
  started: boolean;
  task?: ReturnType<typeof cron.schedule>;
  expression?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __familyCommandCenterSyncScheduler: SchedulerState | undefined;
}

function schedulerState() {
  if (!globalThis.__familyCommandCenterSyncScheduler) {
    globalThis.__familyCommandCenterSyncScheduler = { started: false };
  }
  return globalThis.__familyCommandCenterSyncScheduler;
}

function intervalExpression(minutes: number) {
  if (minutes <= 0) {
    throw new Error("SYNC_INTERVAL_MINUTES must be greater than 0");
  }

  return `*/${minutes} * * * *`;
}

export function configuredSyncCronExpression() {
  const runtimeEnv = getEnv();
  return runtimeEnv.SYNC_CRON?.trim() || intervalExpression(runtimeEnv.SYNC_INTERVAL_MINUTES ?? DEFAULT_SYNC_INTERVAL_MINUTES);
}

function shouldStartScheduler() {
  return typeof window === "undefined" && process.env.NODE_ENV !== "test" && process.env.NEXT_PHASE !== "phase-production-build";
}

export async function hasRunningSyncLog() {
  return prisma.syncLog.findFirst({
    where: { status: "running", finishedAt: null },
    orderBy: { startedAt: "desc" }
  });
}

export async function runScheduledICloudSync() {
  const runningLog = await hasRunningSyncLog();
  if (runningLog) {
    console.log(`Scheduled iCloud sync skipped; sync already running since ${runningLog.startedAt.toISOString()}`);
    return runningLog;
  }

  return syncICloudCalendars();
}

export function startSyncScheduler() {
  const state = schedulerState();
  if (state.started) return state;
  if (!shouldStartScheduler()) return state;

  const expression = configuredSyncCronExpression();
  if (!cron.validate(expression)) {
    throw new Error(`Invalid SYNC_CRON expression: ${expression}`);
  }

  const task = cron.schedule(expression, () => {
    void runScheduledICloudSync().catch(() => {
      console.log("Scheduled iCloud sync failed unexpectedly");
    });
  });

  state.started = true;
  state.task = task;
  state.expression = expression;
  console.log(`Scheduled iCloud sync started with cron expression: ${expression}`);
  return state;
}
