import { getSupabaseServerClient } from "@/lib/supabase/server";
import { WatchlistManager } from "@/components/watchlist/WatchlistManager";
import { getCompanyTitleForTicker } from "@/lib/api-clients/sec-edgar";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const supabase = await getSupabaseServerClient();

  const { data: rawTickers } = await supabase
    .from("watchlist")
    .select("*")
    .eq("is_active", true)
    .order("added_at", { ascending: true });

  const tickers = rawTickers ?? [];

  // Backfill company names for any row that is missing one (fire-and-forget updates)
  const missingName = tickers.filter((t) => !t.company_name);
  if (missingName.length > 0) {
    const resolved = await Promise.all(
      missingName.map(async (t) => ({
        ticker: t.ticker,
        company_name: await getCompanyTitleForTicker(t.ticker).catch(() => null),
      }))
    );
    for (const { ticker, company_name } of resolved) {
      if (company_name) {
        // Patch in memory so the page renders immediately with the name
        const row = tickers.find((t) => t.ticker === ticker);
        if (row) row.company_name = company_name;
        // Persist to DB asynchronously (don't await — we already have the data)
        supabase.from("watchlist").update({ company_name }).eq("ticker", ticker).then(() => {});
      }
    }
  }

  const tickerList = tickers.map((t) => t.ticker);

  // Fetch activity stats per ticker — use parallel count queries to avoid
  // the Supabase default 1 000-row limit that would corrupt aggregate counts.
  const activityStats: Record<string, { total: number; buys: number; sells: number; last_trade: string | null }> = {};

  if (tickerList.length > 0) {
    const BUY_TYPES  = ["buy", "increase", "new_position"];
    const SELL_TYPES = ["sell", "decrease", "closed_position"];

    const statsArr = await Promise.all(
      tickerList.map(async (ticker) => {
        const [buyRes, sellRes, lastRes] = await Promise.all([
          supabase
            .from("institutional_activity")
            .select("*", { count: "exact", head: true })
            .eq("ticker", ticker)
            .in("activity_type", BUY_TYPES),
          supabase
            .from("institutional_activity")
            .select("*", { count: "exact", head: true })
            .eq("ticker", ticker)
            .in("activity_type", SELL_TYPES),
          supabase
            .from("institutional_activity")
            .select("trade_date")
            .eq("ticker", ticker)
            .not("trade_date", "is", null)
            .order("trade_date", { ascending: false })
            .limit(1),
        ]);

        const buys  = buyRes.count  ?? 0;
        const sells = sellRes.count ?? 0;
        const last_trade = lastRes.data?.[0]?.trade_date ?? null;

        return { ticker, buys, sells, total: buys + sells, last_trade };
      })
    );

    for (const s of statsArr) {
      activityStats[s.ticker] = s;
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

      <WatchlistManager initialTickers={tickers} activityStats={activityStats} />
    </div>
  );
}
