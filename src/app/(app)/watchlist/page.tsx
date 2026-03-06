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

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Watchlist</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Stocks you want to monitor for whale activity
        </p>
      </div>

      <WatchlistManager initialTickers={tickers ?? []} />
    </div>
  );
}
