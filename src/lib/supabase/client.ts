import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

// Singleton pattern — reuse the same client across the browser session
let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

// Returns null when Supabase env vars aren't configured (local preview)
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  if (!client) {
    client = createBrowserClient<Database>(url, key);
  }
  return client;
}
