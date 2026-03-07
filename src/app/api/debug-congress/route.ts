// Temporary debug endpoint — diagnose congress data pipeline
// Auth: Bearer ${CRON_SECRET}
// Hit this to see raw data shape, ticker coverage, and fetch errors.
// DELETE after diagnosis.

import { type NextRequest, NextResponse } from "next/server";
import { fetchHouseTrades, fetchSenateTrades, normalizeTicker } from "@/lib/api-clients/congress";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const { data: watchlist } = await supabase
    .from("watchlist")
    .select("ticker")
    .eq("is_active", true);
  const watchedTickers = new Set((watchlist ?? []).map((w) => w.ticker.toUpperCase()));

  const results: Record<string, unknown> = {
    watchlist: Array.from(watchedTickers),
  };

  // ── House ──────────────────────────────────────────────────────────────────
  try {
    const house = await fetchHouseTrades();
    const sample = house.slice(0, 3);
    const allTickers = Array.from(new Set(house.map((t) => normalizeTicker(t.ticker)).filter(Boolean)));
    const matched = house.filter((t) => {
      const tk = normalizeTicker(t.ticker);
      return tk && watchedTickers.has(tk);
    });
    results.house = {
      total: house.length,
      sample_keys: sample.length > 0 ? Object.keys(sample[0]) : [],
      sample,
      unique_tickers_count: allTickers.length,
      watchlist_matches: matched.length,
      matched_sample: matched.slice(0, 3),
    };
  } catch (err) {
    results.house = { error: String(err) };
  }

  // ── Senate ─────────────────────────────────────────────────────────────────
  try {
    const senate = await fetchSenateTrades();
    const sample = senate.slice(0, 3);
    const allTickers = Array.from(new Set(senate.map((t) => normalizeTicker(t.ticker)).filter(Boolean)));
    const matched = senate.filter((t) => {
      const tk = normalizeTicker(t.ticker);
      return tk && watchedTickers.has(tk);
    });
    results.senate = {
      total: senate.length,
      sample_keys: sample.length > 0 ? Object.keys(sample[0]) : [],
      sample,
      unique_tickers_count: allTickers.length,
      watchlist_matches: matched.length,
      matched_sample: matched.slice(0, 3),
    };
  } catch (err) {
    results.senate = { error: String(err) };
  }

  return NextResponse.json(results, { status: 200 });
}
