import { LiveDashboard } from "@/components/dashboard/LiveDashboard";

export const dynamic = "force-dynamic";

export default function DashboardTodayPage() {
  return <LiveDashboard syncDaysAhead={Math.max(Number(process.env.SYNC_DAYS_AHEAD ?? 3), 3)} />;
}
