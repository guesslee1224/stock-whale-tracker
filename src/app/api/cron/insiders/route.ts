// Vercel Cron: Fetch insider trades (Form 4 filings) via SEC EDGAR — FREE
// Form 4 = executives, directors, and 10%+ shareholders reporting stock transactions
// Must be filed within 2 business days — near real-time disclosure.
// Schedule: every 20 minutes during market hours weekdays (see vercel.json)

import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { searchForm4ForTicker } from "@/lib/api-clients/sec-form4";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const startedAt = new Date().toISOString();

  let totalFetched = 0;
  let totalNew = 0;
  const errors: string[] = [];

  const { data: watchlist } = await supabase
    .from("watchlist")
    .select("ticker")
    .eq("is_active", true);

  if (!watchlist?.length) {
    return NextResponse.json({ message: "Watchlist is empty", new: 0 });
  }

  for (const { ticker } of watchlist) {
    // Respect SEC rate limit: max 10 req/sec — conservative 300ms delay
    await delay(300);

    try {
      const hits = await searchForm4ForTicker(ticker);

      if (!hits.length) continue;

      totalFetched += hits.length;

      const records = hits.map((hit) => ({
        ticker,
        source: "sec_form4" as const,
        activity_type: "buy" as const,   // Form 4 acquisitions (A) — filtered by SEC search
        actor_name: hit._source.entity_name ?? null,
        actor_type: "insider" as const,
        trade_date: hit._source.period_of_report ?? null,
        filed_date: hit._source.file_date ?? null,
        raw_payload: hit._source as Record<string, unknown>,
      }));

      const { error, count } = await supabase
        .from("institutional_activity")
        .upsert(records, {
          onConflict: "source,ticker,actor_name,trade_date,activity_type",
          ignoreDuplicates: true,
          count: "exact",
        });

      if (error) errors.push(`DB ${ticker}: ${error.message}`);
      else totalNew += count ?? 0;
    } catch (err) {
      errors.push(`Form4 ${ticker}: ${String(err)}`);
    }
  }

  await supabase.from("fetch_log").insert({
    source: "sec_form4",
    status: errors.length === 0 ? "success" : errors.length < watchlist.length ? "partial" : "error",
    records_fetched: totalFetched,
    records_new: totalNew,
    error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, fetched: totalFetched, new: totalNew });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
