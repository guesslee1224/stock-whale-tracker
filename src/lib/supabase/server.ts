import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

// Use this in Server Components, Server Actions, and Route Handlers
// that need to read the user's auth session from cookies.
export async function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Return a no-op stub when env vars aren't configured (local preview without Supabase)
  if (!url || !key) {
    return createClient<Database>(
      "https://placeholder.supabase.co",
      "placeholder-key",
      { auth: { persistSession: false } }
    ) as ReturnType<typeof createServerClient<Database>>;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll is called from Server Components where cookies cannot be set.
          // This is safe to ignore — the middleware handles session refresh.
        }
      },
    },
  });
}

// Use this in cron routes and server-side jobs that need to bypass RLS.
// NEVER use this on the client or expose SUPABASE_SERVICE_ROLE_KEY to the browser.
export function getSupabaseServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
