import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { searchTickersByQuery } from "@/lib/api-clients/sec-edgar";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Require an active session — prevents unauthenticated scraping of our search endpoint
  const supabase = await getSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  const results = await searchTickersByQuery(q, 8);
  return NextResponse.json({ results });
}
