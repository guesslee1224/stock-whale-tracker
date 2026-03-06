import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// In-memory rate limit store (resets on cold start; adequate for personal use)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }

  if (entry.count >= limit) return false; // blocked

  entry.count++;
  return true; // allowed
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  // ── 1. Protect cron routes with bearer token ──────────────────────────────
  if (pathname.startsWith("/api/cron")) {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    return NextResponse.next();
  }

  // ── 2. Rate-limit auth routes (5 attempts per 5 minutes per IP) ───────────
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/(auth)")) {
    const allowed = rateLimit(`auth:${ip}`, 5, 5 * 60 * 1000);
    if (!allowed) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }
  }

  // ── 3. Supabase session refresh (keeps auth cookies fresh) ────────────────
  let response = NextResponse.next({ request });

  // Skip Supabase entirely if env vars haven't been configured yet
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── 4. Protect app routes — redirect to login if not authenticated ─────────
  const isAppRoute = pathname.startsWith("/(app)") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/feed") ||
    pathname.startsWith("/watchlist") ||
    pathname.startsWith("/settings");

  const isAuthRoute = pathname.startsWith("/login");

  if (isAppRoute && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from login
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|offline.html).*)",
  ],
};
