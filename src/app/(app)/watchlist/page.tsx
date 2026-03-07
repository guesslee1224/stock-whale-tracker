import { getSupabaseServerClient } from "@/lib/supabase/server";
import { WatchlistManager } from "@/components/watchlist/WatchlistManager";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const supabase = await getSupabaseServerClient();

  const { data: tickers } = await supabase
    .from("watchlist")
    .select("*")
    .eq("is_active", true)
    .order("added_at", { ascending: true });

  // Fetch activity stats per ticker for brokerage-style display
  const tickerList = (tickers ?? []).map((t) => t.ticker);

  let activityStats: Record<string, { total: number; buys: number; sells: number; last_trade: string | null }> = {};

  if (tickerList.length > 0) {
    const { data: stats } = await supabase
      .from("institutional_activity")
      .select("ticker, activity_type, trade_date")
      .in("ticker", tickerList);

    if (stats) {
      for (const row of stats) {
        if (!activityStats[row.ticker]) {
          activityStats[row.ticker] = { total: 0, buys: 0, sells: 0, last_trade: null };
        }
        activityStats[row.ticker].total++;
        if (row.activity_type === "buy" || row.activity_type === "increase" || row.activity_type === "new_position") {
          activityStats[row.ticker].buys++;
        } else if (row.activity_type === "sell" || row.activity_type === "decrease" || row.activity_type === "closed_position") {
          activityStats[row.ticker].sells++;
        }
        const td = row.trade_date;
        if (td && (!activityStats[row.ticker].last_trade || td > activityStats[row.ticker].last_trade!)) {
          activityStats[row.ticker].last_trade = td;
        }
      }
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Watchlist</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Monitor whale activity across your tracked symbols
        </p>
      </div>

      <WatchlistManager initialTickers={tickers ?? []} activityStats={activityStats} />
    </div>
  );
}
