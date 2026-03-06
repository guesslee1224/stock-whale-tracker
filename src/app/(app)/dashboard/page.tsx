import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { TopMoversTable } from "@/components/dashboard/TopMoversTable";
import { SyncButton } from "@/components/dashboard/SyncButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();

  // Use fetched_at so 13F filings (which report Q4 dates) still appear in the dashboard
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Fetch data in parallel
  const [
    recentActivityResult,
    alertsResult,
    watchlistResult,
    fetchLogResult,
  ] = await Promise.allSettled([
    supabase
      .from("institutional_activity")
      .select("*")
      .gte("fetched_at", thirtyDaysAgo)
      .order("fetched_at", { ascending: false })
      .limit(200),

    supabase
      .from("alert_history")
      .select("id", { count: "exact", head: true })
      .gte("sent_at", todayStart.toISOString())
      .neq("delivery_status", "skipped_threshold"),

    supabase
      .from("watchlist")
      .select("ticker")
      .eq("is_active", true)
      .limit(5),

    supabase
      .from("fetch_log")
      .select("source, status, completed_at")
      .order("completed_at", { ascending: false })
      .limit(2),
  ]);

  const recentActivity = recentActivityResult.status === "fulfilled" ? recentActivityResult.value.data : null;
  const alertsSentToday = alertsResult.status === "fulfilled" ? (alertsResult.value.count ?? 0) : 0;
  const watchlist = watchlistResult.status === "fulfilled" ? watchlistResult.value.data : null;
  const fetchLog = fetchLogResult.status === "fulfilled" ? fetchLogResult.value.data : null;

  const lastSync = fetchLog?.[0]?.completed_at
    ? new Date(fetchLog[0].completed_at).toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tracking {watchlist?.length ?? 0} ticker{watchlist?.length !== 1 ? "s" : ""}
            {lastSync ? ` · Last sync ${lastSync}` : " · Not yet synced"}
          </p>
        </div>
        <SyncButton />
      </div>

      {/* Summary metrics */}
      <SummaryCards
        activity={recentActivity ?? []}
        alertsSentToday={alertsSentToday ?? 0}
      />

      {/* Top movers + recent activity */}
      <TopMoversTable activity={recentActivity ?? []} />

      {/* Empty state */}
      {(!watchlist?.length) && (
        <div className="border border-dashed border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">
            You have no tickers on your watchlist yet.{" "}
            <a href="/watchlist" className="text-primary underline underline-offset-4">
              Add some tickers
            </a>{" "}
            to start tracking whale activity.
          </p>
        </div>
      )}
    </div>
  );
}
