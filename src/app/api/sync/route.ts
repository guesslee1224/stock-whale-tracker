// Manual sync endpoint — authenticated users can trigger all data crons on demand.
// Auth: Supabase user session (not CRON_SECRET — this is user-facing).

import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Verify the user is logged in
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Build base URL from request so it works on localhost and on Vercel
  const origin = request.headers.get("origin") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const headers = { Authorization: `Bearer ${cronSecret}` };

  // Run all three crons in parallel (each has its own 60s timeout via maxDuration)
  const [insidersRes, edgarRes, congressRes] = await Promise.allSettled([
    fetch(`${origin}/api/cron/insiders`, { headers }).then((r) => r.json()),
    fetch(`${origin}/api/cron/sec-edgar`, { headers }).then((r) => r.json()),
    fetch(`${origin}/api/cron/congress`, { headers }).then((r) => r.json()),
  ]);

  const summary = {
    insiders:
      insidersRes.status === "fulfilled"
        ? insidersRes.value
        : { error: String((insidersRes as PromiseRejectedResult).reason) },
    edgar:
      edgarRes.status === "fulfilled"
        ? edgarRes.value
        : { error: String((edgarRes as PromiseRejectedResult).reason) },
    congress:
      congressRes.status === "fulfilled"
        ? congressRes.value
        : { error: String((congressRes as PromiseRejectedResult).reason) },
  };

  const totalNew =
    (summary.insiders.new ?? 0) +
    (summary.edgar.new ?? 0) +
    (summary.congress.new ?? 0);

  return NextResponse.json({ success: true, totalNew, summary });
}
