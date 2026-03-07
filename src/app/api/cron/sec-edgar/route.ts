// Vercel Cron Job: Poll SEC EDGAR for recent 13F institutional ownership filings
// Schedule: daily at 7am weekdays (see vercel.json)
// Auth: Bearer ${CRON_SECRET} validated by middleware.ts
//
// Pipeline per ticker:
//   1. EFTS full-text search → recent 13F-HR filings mentioning the ticker
//   2. For each filing: fetch the information table XML → extract position (shares, value)
//   3. Compare to previous quarter's DB record to classify:
//        new_position / increase / decrease / closed_position
//   4. Upsert enriched records (unique on source+ticker+actor_name+trade_date)

import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  searchEdgarFor13F,
  getCompanyTitleForTicker,
  fetch13FPositionForTicker,
} from "@/lib/api-clients/sec-edgar";
import type { Database } from "@/types/database.types";

type ActivityType = Database["public"]["Tables"]["institutional_activity"]["Insert"]["activity_type"];
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

  const { data: watchlist } = await supabase
    .from("watchlist")
    .select("ticker")
    .eq("is_active", true);

  if (!watchlist?.length) {
    return NextResponse.json({ message: "Watchlist is empty", new: 0 });
  }

  for (const { ticker } of watchlist) {
    await delay(300); // SEC rate limit: be conservative

    try {
      // ── 1. EFTS search for recent 13F filings ────────────────────────────
      const searchResult = await searchEdgarFor13F(ticker);
      if (!searchResult?.hits?.hits?.length) continue;

      const companyTitle = (await getCompanyTitleForTicker(ticker)) ?? ticker;

      type EftsHit = {
        _source: {
          adsh?: string;
          ciks?: string[];
          entity_name?: string;
          display_names?: string[];
          file_date?: string;
          period_of_report?: string;
          [key: string]: unknown;
        };
      };
      const hits = searchResult.hits.hits as EftsHit[];
      totalFetched += hits.length;

      // ── 2. Load previous holdings for this ticker (for quarter comparison) ─
      // One query per ticker: get the most recent record per institution
      const { data: prevRecords } = await supabase
        .from("institutional_activity")
        .select("actor_name, shares, trade_date, value_usd")
        .eq("source", "sec_13f")
        .eq("ticker", ticker)
        .order("trade_date", { ascending: false });

      // Build a map: actor_name → most recent record
      const prevByActor = new Map<
        string,
        { shares: number | null; trade_date: string | null; value_usd: number | null }
      >();
      for (const rec of prevRecords ?? []) {
        if (rec.actor_name && !prevByActor.has(rec.actor_name)) {
          prevByActor.set(rec.actor_name, {
            shares: rec.shares,
            trade_date: rec.trade_date,
            value_usd: rec.value_usd,
          });
        }
      }

      // ── 3. Process each filing (cap at 8 to stay within 60s timeout) ─────
      const records: Database["public"]["Tables"]["institutional_activity"]["Insert"][] = [];

      for (const hit of hits.slice(0, 8)) {
        await delay(200); // between XML fetches for the same ticker

        const src = hit._source;
        const accNo = (src.adsh as string | undefined) ?? "";
        if (!accNo) continue;

        // Institution CIK — first entry in ciks[], or extract from accession number
        const cikRaw = (src.ciks as string[] | undefined)?.[0] ?? accNo.split("-")[0];
        const filerCik = cikRaw.replace(/^0+/, "");

        // Clean institution name
        const rawName =
          src.entity_name ??
          (Array.isArray(src.display_names) ? (src.display_names as string[])[0] : null) ??
          null;
        const entityName = rawName ? rawName.split(/\s*\(CIK/)[0].trim() || null : null;

        const filedDate = (src.file_date as string | undefined) ?? null;
        const periodDate = (src.period_of_report as string | undefined) ?? null;

        // ── 4. Fetch position detail from 13F information table XML ─────────
        let position: Awaited<ReturnType<typeof fetch13FPositionForTicker>> = null;
        if (filerCik && accNo) {
          position = await fetch13FPositionForTicker(accNo, filerCik, companyTitle);
        }

        const shares = position?.shares ?? null;
        const valueCents = position && position.valueCents > 0 ? position.valueCents : null;
        const putCall = position?.putCall ?? null;

        // ── 5. Determine activity_type by comparing to previous quarter ─────
        let activityType: ActivityType = "increase";
        if (entityName) {
          const prev = prevByActor.get(entityName);
          if (!prev) {
            activityType = "new_position";
          } else if (shares !== null && prev.shares !== null) {
            if (shares > prev.shares) activityType = "increase";
            else if (shares < prev.shares) activityType = "decrease";
            else activityType = "increase"; // unchanged — still a reported holding
          }
        }

        records.push({
          ticker,
          source: "sec_13f",
          activity_type: activityType,
          actor_name: entityName,
          actor_type: "institution",
          filed_date: filedDate,
          trade_date: periodDate,
          value_usd: valueCents,
          shares: shares,
          raw_payload: {
            ...(src as Record<string, unknown>),
            entity_name: entityName,
            shares: shares,
            value_usd_dollars: valueCents ? valueCents / 100 : null,
            put_call: putCall,
          } as Json,
        });
      }

      if (records.length > 0) {
        const { error, count } = await supabase
          .from("institutional_activity")
          .upsert(records, {
            // Unique constraint is now (source, ticker, actor_name, trade_date)
            // ignoreDuplicates: false so re-runs UPDATE activity_type + shares
            onConflict: "source,ticker,actor_name,trade_date",
            ignoreDuplicates: false,
            count: "exact",
          });

        if (error) errors.push(`DB ${ticker}: ${error.message}`);
        else totalNew += count ?? 0;
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
