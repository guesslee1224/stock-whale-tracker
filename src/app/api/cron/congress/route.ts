// Vercel Cron: Fetch congressional stock trades — FREE, no API key required
// Sources: housestockwatcher.com (House) + senatestockwatcher.com (Senate)
// Both aggregate official STOCK Act PTR filings from government disclosure portals.
// Schedule: every 20 minutes during market hours weekdays (see vercel.json)

import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  fetchHouseTrades,
  fetchSenateTrades,
  parseAmountRange,
  isHousePurchase,
  isSenatePurchase,
  normalizeTicker,
} from "@/lib/api-clients/congress";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  // Get active watchlist tickers
  const { data: watchlist } = await supabase
    .from("watchlist")
    .select("ticker")
    .eq("is_active", true);

  if (!watchlist?.length) {
    return NextResponse.json({ message: "Watchlist is empty", new: 0 });
  }

  const watchedTickers = new Set(watchlist.map((w) => w.ticker.toUpperCase()));

  // Fetch all recent trades from both chambers in parallel
  let houseTrades: Awaited<ReturnType<typeof fetchHouseTrades>> = [];
  let senateTrades: Awaited<ReturnType<typeof fetchSenateTrades>> = [];

  try {
    [houseTrades, senateTrades] = await Promise.all([
      fetchHouseTrades(),
      fetchSenateTrades(),
    ]);
  } catch (err) {
    errors.push(`Fetch error: ${String(err)}`);
  }

  const totalFetched = houseTrades.length + senateTrades.length;
  let totalNew = 0;

  // ── House member trades ───────────────────────────────────────────────────
  const houseRecords = houseTrades
    .filter((t) => {
      const ticker = normalizeTicker(t.ticker);
      return ticker && watchedTickers.has(ticker) && isHousePurchase(t.type ?? "");
    })
    .map((t) => ({
      ticker: normalizeTicker(t.ticker)!,
      source: "house_congress" as const,
      activity_type: "buy" as const,
      actor_name: t.representative ?? t.owner ?? null,
      actor_type: "congress" as const,
      trade_date: t.transaction_date ?? null,
      filed_date: t.disclosure_date ?? null,
      value_usd: parseAmountRange(t.amount),
      raw_payload: t as unknown as import("@/types/database.types").Json,
    }));

  // ── Senate member trades ──────────────────────────────────────────────────
  const senateRecords = senateTrades
    .filter((t) => {
      const ticker = normalizeTicker(t.ticker);
      return ticker && watchedTickers.has(ticker) && isSenatePurchase(t.type ?? "");
    })
    .map((t) => ({
      ticker: normalizeTicker(t.ticker)!,
      source: "senate_congress" as const,
      activity_type: "buy" as const,
      actor_name: t.senator ?? null,
      actor_type: "congress" as const,
      trade_date: t.transaction_date ?? null,
      filed_date: t.disclosure_date ?? null,
      value_usd: parseAmountRange(t.amount),
      raw_payload: t as unknown as import("@/types/database.types").Json,
    }));

  const allRecords = [...houseRecords, ...senateRecords];

  if (allRecords.length > 0) {
    const { error, count } = await supabase
      .from("institutional_activity")
      .upsert(allRecords, {
        onConflict: "source,ticker,actor_name,trade_date,activity_type",
        ignoreDuplicates: true,
        count: "exact",
      });

    if (error) errors.push(`DB upsert: ${error.message}`);
    else totalNew += count ?? 0;
  }

  await supabase.from("fetch_log").insert({
    source: "congress",
    status: errors.length === 0 ? "success" : "partial",
    records_fetched: totalFetched,
    records_new: totalNew,
    error_message: errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    fetched: totalFetched,
    matched: allRecords.length,
    new: totalNew,
    errors: errors.length,
  });
}
