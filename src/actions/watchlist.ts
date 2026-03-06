"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Validates a ticker symbol format (1-5 uppercase letters)
function isValidTicker(ticker: string): boolean {
  return /^[A-Z]{1,5}$/.test(ticker.trim().toUpperCase());
}

export async function addToWatchlist(ticker: string): Promise<{ error?: string }> {
  const supabase = await getSupabaseServerClient();
  const upperTicker = ticker.trim().toUpperCase();

  if (!isValidTicker(upperTicker)) {
    return { error: "Invalid ticker symbol. Use 1–5 letters (e.g. AAPL, TSLA)." };
  }

  const { error } = await supabase.from("watchlist").upsert(
    { ticker: upperTicker, is_active: true },
    { onConflict: "ticker" }
  );

  if (error) return { error: error.message };

  revalidatePath("/watchlist");
  revalidatePath("/dashboard");
  return {};
}

export async function removeFromWatchlist(ticker: string): Promise<{ error?: string }> {
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase
    .from("watchlist")
    .update({ is_active: false })
    .eq("ticker", ticker.toUpperCase());

  if (error) return { error: error.message };

  revalidatePath("/watchlist");
  revalidatePath("/dashboard");
  return {};
}
