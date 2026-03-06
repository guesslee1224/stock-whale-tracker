// DEPRECATED — Quiver API replaced by free sources.
// Congressional trades: /api/cron/congress (housestockwatcher.com + senatestockwatcher.com)
// Insider trades:       /api/cron/insiders (SEC EDGAR Form 4)
// This route is no longer registered in vercel.json.

import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  fetchCongressTrades,
  fetchInsiderTrades,
  parseCongressAmount,
} from "@/lib/api-clients/quiver";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Auth is already validated by middleware.ts — this is belt-and-suspenders
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const startedAt = new Date().toISOString();

  let totalFetched = 0;
  let totalNew = 0;
  const errors: string[] = [];

  // Get active watchlist tickers
  const { data: watchlist } = await supabase
    .from("watchlist")
    .select("ticker")
    .eq("is_active", true);

  if (!watchlist?.length) {
    return NextResponse.json({ message: "Watchlist is empty", new: 0 });
  }

  for (const { ticker } of watchlist) {
    // Small delay between tickers to respect Quiver rate limits
    await delay(150);

    // ── Congressional trades ──────────────────────────────────────────────
    try {
      const congressData = await fetchCongressTrades(ticker);
      if (Array.isArray(congressData)) {
        totalFetched += congressData.length;

        const records = congressData
          .filter((t: Record<string, string>) => t.Transaction === "Purchase")
          .map((t: Record<string, string>) => ({
            ticker,
            source: "quiver_congress" as const,
            activity_type: "buy" as const,
            actor_name: t.Representative ?? null,
            actor_type: "congress" as const,
            trade_date: t.TransactionDate ?? null,
            filed_date: t.ReportDate ?? null,
            value_usd: parseCongressAmount(t.Amount),
            raw_payload: t,
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
      }
    } catch (err) {
      errors.push(`Congress ${ticker}: ${String(err)}`);
    }

    await delay(150);

    // ── Insider trades ────────────────────────────────────────────────────
    try {
      const insiderData = await fetchInsiderTrades(ticker);
      if (Array.isArray(insiderData)) {
        totalFetched += insiderData.length;

        const records = insiderData
          .filter((t: Record<string, string | number>) => t.AcquisitionDisposition === "A") // A = Acquisition
          .map((t: Record<string, string | number>) => {
            const shares = Number(t.Shares) || null;
            const price = Number(t.PricePerShare) || null;
            const valueUsd =
              shares && price ? Math.round(shares * price * 100) : null;

            return {
              ticker,
              source: "quiver_insider" as const,
              activity_type: "buy" as const,
              actor_name: String(t.Name ?? ""),
              actor_type: "insider" as const,
              trade_date: String(t.Date ?? ""),
              value_usd: valueUsd,
              shares: shares,
              price_per_share: price,
              raw_payload: t,
            };
          });

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
      }
    } catch (err) {
      errors.push(`Insider ${ticker}: ${String(err)}`);
    }
  }

  // Log the run result
  await supabase.from("fetch_log").insert({
    source: "quiver",
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
