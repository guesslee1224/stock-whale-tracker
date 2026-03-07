import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { TopMoversTable } from "@/components/dashboard/TopMoversTable";
import { SyncButton } from "@/components/dashboard/SyncButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();

  // Use fetched_at so 13F filings (which report Q4 dates) still appear in the dashboard
  // eslint-disable-next-line react-hooks/purity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const BUY_TYPES  = ["buy", "new_position", "increase"];
  const SELL_TYPES = ["sell", "decrease", "closed_position"];

  // Fetch all data in parallel
  const [
    recentActivityResult,
    alertsResult,
    watchlistCountResult,
    fetchLogResult,
    buyCountResult,
    sellCountResult,
    congressCountResult,
    insiderCountResult,
  ] = await Promise.allSettled([
    // Recent activity for the feed table (up to 500 records, sorted by fetch time)
    supabase
      .from("institutional_activity")
      .select("*")
      .gte("fetched_at", thirtyDaysAgo)
      .order("fetched_at", { ascending: false })
      .limit(500),

    // Alert count for today
    supabase
      .from("alert_history")
      .select("id", { count: "exact", head: true })
      .gte("sent_at", todayStart.toISOString())
      .neq("delivery_status", "skipped_threshold"),

    // Active watchlist count (no row limit — head:true is fast)
    supabase
      .from("watchlist")
      .select("ticker", { count: "exact", head: true })
      .eq("is_active", true),

    // Last sync time
    supabase
      .from("fetch_log")
      .select("source, status, completed_at")
      .order("completed_at", { ascending: false })
      .limit(2),

    // 30-day buy signal count (exact, bypasses row limit)
    supabase
      .from("institutional_activity")
      .select("*", { count: "exact", head: true })
      .in("activity_type", BUY_TYPES)
      .gte("fetched_at", thirtyDaysAgo),

    // 30-day sell signal count
    supabase
      .from("institutional_activity")
      .select("*", { count: "exact", head: true })
      .in("activity_type", SELL_TYPES)
      .gte("fetched_at", thirtyDaysAgo),

    // 30-day congress count
    supabase
      .from("institutional_activity")
      .select("*", { count: "exact", head: true })
      .eq("actor_type", "congress")
      .gte("fetched_at", thirtyDaysAgo),

    // 30-day insider count
    supabase
      .from("institutional_activity")
      .select("*", { count: "exact", head: true })
      .eq("actor_type", "insider")
      .gte("fetched_at", thirtyDaysAgo),
  ]);

  const recentActivity = recentActivityResult.status === "fulfilled" ? recentActivityResult.value.data : null;
  const alertsSentToday = alertsResult.status === "fulfilled" ? (alertsResult.value.count ?? 0) : 0;
  const watchlistCount  = watchlistCountResult.status === "fulfilled" ? (watchlistCountResult.value.count ?? 0) : 0;
  const fetchLog        = fetchLogResult.status === "fulfilled" ? fetchLogResult.value.data : null;
  const buyCount        = buyCountResult.status === "fulfilled" ? (buyCountResult.value.count ?? 0) : 0;
  const sellCount       = sellCountResult.status === "fulfilled" ? (sellCountResult.value.count ?? 0) : 0;
  const congressCount   = congressCountResult.status === "fulfilled" ? (congressCountResult.value.count ?? 0) : 0;
  const insiderCount    = insiderCountResult.status === "fulfilled" ? (insiderCountResult.value.count ?? 0) : 0;

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
            Tracking {watchlistCount} ticker{watchlistCount !== 1 ? "s" : ""}
            {lastSync ? ` · Last sync ${lastSync}` : " · Not yet synced"}
          </p>
        </div>
        <SyncButton />
      </div>

      {/* Summary metrics */}
      <SummaryCards
        buyCount={buyCount}
        sellCount={sellCount}
        congressCount={congressCount}
        insiderCount={insiderCount}
        alertsSentToday={alertsSentToday}
      />

      {/* Top movers + recent activity */}
      <TopMoversTable activity={recentActivity ?? []} />

      {/* Empty state */}
      {watchlistCount === 0 && (
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
