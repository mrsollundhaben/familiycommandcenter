import { z } from "zod";

const envSchema = z.object({
  ICLOUD_USERNAME: z.string().optional(),
  ICLOUD_APP_PASSWORD: z.string().optional(),
  CALDAV_URL: z.string().url().default("https://caldav.icloud.com"),
  DATABASE_URL: z.string().default("file:./dev.db"),
  ADMIN_PIN: z.string().min(4).optional(),
  SESSION_SECRET: z.string().min(16).optional(),
  DEFAULT_TIMEZONE: z.string().default("Europe/Vienna"),
  SYNC_DAYS_AHEAD: z.coerce.number().int().min(1).max(14).default(3)
});

export const env = envSchema.parse(process.env);

export function requireAdminPin() {
  if (!env.ADMIN_PIN) {
    throw new Error("ADMIN_PIN is not configured");
  }
  return env.ADMIN_PIN;
}
