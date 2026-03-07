// Per-ticker sync endpoint — called automatically when a symbol is added to the watchlist.
// Auth: Supabase user session (same as /api/sync).
// Only runs the insiders + sec-edgar crons for the requested ticker, so it's fast.

import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const ticker = (body.ticker as string | undefined)?.trim().toUpperCase();

  if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const origin =
    request.headers.get("origin") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const headers = { Authorization: `Bearer ${cronSecret}` };

  // Run insiders + sec-edgar in parallel for just this ticker (congress is lower priority for new adds)
  const [insidersRes, edgarRes] = await Promise.allSettled([
    fetch(`${origin}/api/cron/insiders?ticker=${ticker}`, { headers }).then((r) => r.json()),
    fetch(`${origin}/api/cron/sec-edgar?ticker=${ticker}`, { headers }).then((r) => r.json()),
  ]);

  const summary = {
    insiders: insidersRes.status === "fulfilled" ? insidersRes.value : { error: String((insidersRes as PromiseRejectedResult).reason) },
    edgar:    edgarRes.status  === "fulfilled" ? edgarRes.value  : { error: String((edgarRes  as PromiseRejectedResult).reason) },
  };

  const totalNew = (summary.insiders.new ?? 0) + (summary.edgar.new ?? 0);

  return NextResponse.json({ success: true, ticker, totalNew, summary });
}
