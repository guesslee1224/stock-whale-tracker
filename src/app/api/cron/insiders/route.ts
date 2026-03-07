// Vercel Cron: Fetch insider trades (Form 4 filings) via SEC EDGAR — FREE
// Parses actual Form 4 XML filings for full detail:
//   owner name, officer title, shares, price per share, transaction date
// Schedule: daily at 5pm weekdays (see vercel.json)

import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getEnrichedForm4Transactions } from "@/lib/api-clients/sec-form4";
import type { Database } from "@/types/database.types";

type Json = Database["public"]["Tables"]["institutional_activity"]["Insert"]["raw_payload"];

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

  // Optional ?ticker= param — when set, only process that one symbol
  const tickerParam = request.nextUrl.searchParams.get("ticker")?.toUpperCase() ?? null;

  let { data: watchlist } = await supabase
    .from("watchlist")
    .select("ticker")
    .eq("is_active", true);

  if (!watchlist?.length) {
    return NextResponse.json({ message: "Watchlist is empty", new: 0 });
  }

  if (tickerParam) {
    watchlist = watchlist.filter((w) => w.ticker === tickerParam);
    if (!watchlist.length) {
      return NextResponse.json({ message: `${tickerParam} not in watchlist`, new: 0 });
    }
  }

  for (const { ticker } of watchlist) {
    const result = await getEnrichedForm4Transactions(ticker, 21);
    errors.push(...result.errors);

    if (!result.transactions.length) continue;

    totalFetched += result.transactions.length;

    const records = result.transactions.map((tx) => ({
      ticker,
      source: "sec_form4" as const,
      // Map acquiredDisposed correctly: A = buy, D = sell
      activity_type: (tx.acquiredDisposed === "A" ? "buy" : "sell") as "buy" | "sell",
      actor_name: tx.ownerName ?? null,
      actor_type: "insider" as const,
      trade_date: tx.transactionDate ?? null,
      filed_date: tx.filingDate ?? null,
      value_usd: tx.valueUsd ? Math.round(tx.valueUsd * 100) : null, // store in cents
      raw_payload: {
        owner_name: tx.ownerName,
        owner_title: tx.ownerTitle,
        owner_relation: tx.ownerRelation,
        shares: tx.shares,
        price_per_share: tx.pricePerShare,
        value_usd_dollars: tx.valueUsd,
        transaction_code: tx.transactionCode,
        acquired_disposed: tx.acquiredDisposed,
        accession_number: tx.accessionNumber,
        sec_filing_url: tx.secFilingUrl,
      } as unknown as Json,
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

  return NextResponse.json({
    success: true,
    fetched: totalFetched,
    new: totalNew,
    errors: errors.length > 0 ? errors.slice(0, 3) : undefined,
  });
}
