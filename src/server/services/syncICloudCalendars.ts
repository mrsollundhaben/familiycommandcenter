import { prisma } from "@/server/db/prisma";
import { env } from "@/server/config/env";

export async function syncICloudCalendars() {
  const log = await prisma.syncLog.create({ data: { status: "running", message: "iCloud sync started" } });

  if (!env.ICLOUD_USERNAME || !env.ICLOUD_APP_PASSWORD) {
    return prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        message: "iCloud credentials are not configured. Set ICLOUD_USERNAME and ICLOUD_APP_PASSWORD.",
        errors: [{ code: "CALDAV_NOT_CONFIGURED" }]
      }
    });
  }

  // The first iteration wires a safe read-only sync boundary and status logging.
  // The concrete CalDAV fetch/ICS expansion will plug in here behind this service.
  return prisma.syncLog.update({
    where: { id: log.id },
    data: {
      status: "partial",
      finishedAt: new Date(),
      message: "CalDAV credentials detected. Read-only CalDAV import implementation is the next ticket.",
      eventsFetched: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0
    }
  });
}
