// Vercel Cron: Fetch congressional stock trades
// Schedule: every 20 minutes during market hours weekdays (see vercel.json)
//
// Data sources (in priority order):
//   1. Quiver Quantitative API — per-ticker, proven reliable from Vercel IPs.
//      Requires QUIVER_API_KEY. Returns both purchases AND sales.
//   2. House S3 bucket + Senate GitHub CDN — free, no key required.
//      Bulk fetch then filter by watchlist. Falls back if Quiver unavailable.

import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  fetchHouseTrades,
  fetchSenateTrades,
  parseAmountRange,
  normalizeTicker,
} from "@/lib/api-clients/congress";
import { fetchCongressTrades, parseCongressAmount } from "@/lib/api-clients/quiver";
import type { Database } from "@/types/database.types";

type ActivityInsert = Database["public"]["Tables"]["institutional_activity"]["Insert"];
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
  const errors: string[] = [];

  const { data: watchlist } = await supabase
    .from("watchlist")
    .select("ticker")
    .eq("is_active", true);

  if (!watchlist?.length) {
    return NextResponse.json({ message: "Watchlist is empty", new: 0 });
  }

  const allRecords: ActivityInsert[] = [];
  let totalFetched = 0;
  let totalNew = 0;

  // ── Strategy 1: Quiver Quantitative (per-ticker, no IP restrictions) ────────
  if (process.env.QUIVER_API_KEY) {
    for (const { ticker } of watchlist) {
      try {
        await delay(300);
        const raw = await fetchCongressTrades(ticker);
        if (!Array.isArray(raw)) continue;

        totalFetched += raw.length;

        // Quiver congress fields: Representative, Transaction, Amount,
        // TransactionDate, ReportDate, House ("House" | "Senate")
        for (const t of raw) {
          const transaction = (t.Transaction as string | undefined) ?? "";
          const isBuy = transaction.toLowerCase().includes("purchase");
          const isSell = transaction.toLowerCase().includes("sale");
          if (!isBuy && !isSell) continue;

          const chamber = ((t.House as string | undefined) ?? "").toLowerCase();
          const source = chamber === "senate" ? "senate_congress" as const : "house_congress" as const;

          allRecords.push({
            ticker,
            source,
            activity_type: isBuy ? "buy" : "sell",
            actor_name: (t.Representative as string | null) ?? null,
            actor_type: "congress",
            trade_date: (t.TransactionDate as string | null) ?? null,
            filed_date: (t.ReportDate as string | null) ?? null,
            value_usd: parseCongressAmount(t.Amount as string | undefined),
            raw_payload: t as unknown as Json,
          });
        }
      } catch (err) {
        errors.push(`Quiver ${ticker}: ${String(err)}`);
      }
    }
  } else {
    // ── Strategy 2: Free bulk sources (House S3 + Senate GitHub CDN) ──────────
    const watchedTickers = new Set(watchlist.map((w) => w.ticker.toUpperCase()));

    let houseTrades: Awaited<ReturnType<typeof fetchHouseTrades>> = [];
    let senateTrades: Awaited<ReturnType<typeof fetchSenateTrades>> = [];

    const [houseResult, senateResult] = await Promise.allSettled([
      fetchHouseTrades(),
      fetchSenateTrades(),
    ]);

    if (houseResult.status === "fulfilled") {
      houseTrades = houseResult.value;
    } else {
      errors.push(`House fetch: ${String(houseResult.reason)}`);
    }

    if (senateResult.status === "fulfilled") {
      senateTrades = senateResult.value;
    } else {
      errors.push(`Senate fetch: ${String(senateResult.reason)}`);
    }

    totalFetched = houseTrades.length + senateTrades.length;

    // House
    for (const t of houseTrades) {
      const ticker = normalizeTicker(t.ticker);
      if (!ticker || !watchedTickers.has(ticker)) continue;

      const typeLower = (t.type ?? "").toLowerCase();
      const isBuy = typeLower.includes("purchase");
      const isSell = typeLower.includes("sale");
      if (!isBuy && !isSell) continue;

      // Try multiple field name variants for representative name
      const actorName =
        t.representative ||
        (t as unknown as Record<string, string>)["name"] ||
        t.owner ||
        null;

      allRecords.push({
        ticker,
        source: "house_congress",
        activity_type: isBuy ? "buy" : "sell",
        actor_name: actorName ?? null,
        actor_type: "congress",
        trade_date: t.transaction_date ?? null,
        filed_date: t.disclosure_date ?? null,
        value_usd: parseAmountRange(t.amount),
        raw_payload: t as unknown as Json,
      });
    }

    // Senate
    for (const t of senateTrades) {
      const ticker = normalizeTicker(t.ticker);
      if (!ticker || !watchedTickers.has(ticker)) continue;

      const typeLower = (t.type ?? "").toLowerCase();
      const isBuy = typeLower.includes("purchase");
      const isSell = typeLower.includes("sale");
      if (!isBuy && !isSell) continue;

      // Try multiple field name variants for senator name
      const raw = t as unknown as Record<string, unknown>;
      const actorName =
        t.senator ||
        (raw["first_name"] && raw["last_name"]
          ? `${raw["first_name"]} ${raw["last_name"]}`
          : null) ||
        (raw["name"] as string | undefined) ||
        null;

      allRecords.push({
        ticker,
        source: "senate_congress",
        activity_type: isBuy ? "buy" : "sell",
        actor_name: actorName ?? null,
        actor_type: "congress",
        trade_date: t.transaction_date ?? null,
        filed_date: t.disclosure_date ?? null,
        value_usd: parseAmountRange(t.amount),
        raw_payload: t as unknown as Json,
      });
    }
  }

  // ── Upsert all collected records ──────────────────────────────────────────
  if (allRecords.length > 0) {
    const { error, count } = await supabase
      .from("institutional_activity")
      .upsert(allRecords, {
        onConflict: "source,ticker,actor_name,trade_date",
        ignoreDuplicates: true,
        count: "exact",
      });

    if (error) errors.push(`DB upsert: ${error.message}`);
    else totalNew += count ?? 0;
  }

  const source = process.env.QUIVER_API_KEY ? "quiver" : "free_apis";

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
    data_source: source,
    fetched: totalFetched,
    matched: allRecords.length,
    new: totalNew,
    errors: errors.length > 0 ? errors : undefined,
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
