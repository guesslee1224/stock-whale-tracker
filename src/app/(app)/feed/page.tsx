import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ActivityFeed } from "@/components/feed/ActivityFeed";
import { SyncButton } from "@/components/dashboard/SyncButton";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = await getSupabaseServerClient();

  // Query each source group separately so institutional 13F volume
  // can never crowd out insider or congress records.
  const [insidersResult, institutionsResult, congressResult] = await Promise.allSettled([
    supabase
      .from("institutional_activity")
      .select("*")
      .in("source", ["sec_form4", "quiver_insider"])
      .order("fetched_at", { ascending: false })
      .limit(300),

    supabase
      .from("institutional_activity")
      .select("*")
      .in("source", ["sec_13f", "quiver_institutional"])
      .order("fetched_at", { ascending: false })
      .limit(1000),

    supabase
      .from("institutional_activity")
      .select("*")
      .in("source", ["house_congress", "senate_congress", "quiver_congress"])
      .order("fetched_at", { ascending: false })
      .limit(300),
  ]);

  const activity = [
    ...(insidersResult.status === "fulfilled" ? (insidersResult.value.data ?? []) : []),
    ...(institutionsResult.status === "fulfilled" ? (institutionsResult.value.data ?? []) : []),
    ...(congressResult.status === "fulfilled" ? (congressResult.value.data ?? []) : []),
  ];

  // Watchlist tickers drive the dropdown — show all symbols even before they have activity
  const { data: watchlistRows } = await supabase
    .from("watchlist")
    .select("ticker")
    .eq("is_active", true)
    .order("ticker", { ascending: true });

  const watchlistTickers = (watchlistRows ?? []).map((r) => r.ticker);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activity Feed</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live updates — new trades appear automatically
          </p>
        </div>
        <SyncButton />
      </div>

      <ActivityFeed initialItems={activity} watchlistTickers={watchlistTickers} />
    </div>
  );
}
