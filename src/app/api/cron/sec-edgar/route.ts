// Vercel Cron Job: Poll SEC EDGAR for recent 13F institutional ownership filings
// Schedule: daily at 7am weekdays (see vercel.json)
// Auth: Bearer ${CRON_SECRET} validated by middleware.ts

import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { searchEdgarFor13F } from "@/lib/api-clients/sec-edgar";

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
    // SEC rate limit: 10 req/sec — be conservative
    await delay(300);

    try {
      const searchResult = await searchEdgarFor13F(ticker);

      if (!searchResult?.hits?.hits?.length) continue;

      const filings = searchResult.hits.hits as Array<{
        _source: {
          entity_name?: string;
          file_date?: string;
          period_of_report?: string;
          [key: string]: unknown;
        };
      }>;

      totalFetched += filings.length;

      const records = filings.map((hit) => ({
        ticker,
        source: "sec_13f" as const,
        activity_type: "increase" as const, // 13F indicates a holding was reported
        actor_name: hit._source.entity_name ?? null,
        actor_type: "institution" as const,
        filed_date: hit._source.file_date ?? null,
        trade_date: hit._source.period_of_report ?? null,
        raw_payload: hit._source as import("@/types/database.types").Json,
      }));

      if (records.length > 0) {
        const { error, count } = await supabase
          .from("institutional_activity")
          .upsert(records, {
            onConflict: "source,ticker,actor_name,trade_date,activity_type",
            ignoreDuplicates: true,
            count: "exact",
          });

        if (!error) totalNew += count ?? 0;
      }
    } catch (err) {
      errors.push(`SEC ${ticker}: ${String(err)}`);
    }
  }

  await supabase.from("fetch_log").insert({
    source: "sec_edgar",
    status: errors.length === 0 ? "success" : "partial",
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
