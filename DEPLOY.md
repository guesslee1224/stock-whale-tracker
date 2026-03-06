# Stock Whale Tracker — Deployment Guide

> VAPID keys and CRON_SECRET are already pre-generated in `.env.local`.  
> You only need to fill in **3 values** from external services.

---

## Step 1 — Create a Supabase project

1. Go to **[supabase.com](https://supabase.com)** → New project  
   (choose a region close to you, e.g. US East)

2. Once the project is ready, open the **SQL Editor** and run both migration files **in order**:
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_realtime.sql`

3. Enable Realtime:  
   **Table Editor → `institutional_activity` → Realtime toggle → Enable**

4. Create your user account:  
   **Authentication → Users → Add user**  
   Use email: `gsaintaubin1224@gmail.com` + a strong password

5. Copy your API keys:  
   **Settings → API** — you need three values:
   | .env.local key | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
   | `SUPABASE_SERVICE_ROLE_KEY` | `service_role` `secret` key |

---

## Step 2 — Fill in `.env.local`

Open `.env.local` (already in your project folder) and replace the three placeholder values:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
QUIVER_API_KEY=your-key-from-step-3
```

Everything else (VAPID keys, CRON_SECRET, VAPID_EMAIL, ALLOWED_EMAIL) is already filled in.

---

## Step 3 — Get Quiver Quantitative API key

1. Sign up at **[quiverquant.com](https://www.quiverquant.com)** — the **$10/month** plan covers:
   - Congressional trades
   - Insider trades
   - Institutional holdings

2. After signup, copy your API key from the dashboard and paste it into `.env.local`:
   ```
   QUIVER_API_KEY=your-key-here
   ```

---

## Step 4 — Deploy to Vercel

```bash
cd stock-whale-tracker
npx vercel
```

Follow the prompts (link to your Vercel account, create a new project).

Then add **all environment variables** to Vercel:  
**Vercel dashboard → your project → Settings → Environment Variables**

Copy every line from `.env.local` — you need all of them:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase |
| `QUIVER_API_KEY` | from Quiver |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | already in .env.local |
| `VAPID_PRIVATE_KEY` | already in .env.local |
| `VAPID_EMAIL` | `mailto:gsaintaubin1224@gmail.com` |
| `CRON_SECRET` | already in .env.local |
| `ALLOWED_EMAIL` | `gsaintaubin1224@gmail.com` |

After setting env vars, run a production deploy:
```bash
npx vercel --prod
```

Cron jobs start automatically per `vercel.json`:
- Every 20 min (market hours, weekdays) → fetch Quiver data
- 7 AM daily (weekdays) → fetch SEC EDGAR filings
- Every 5 min → process and send alerts

---

## Step 5 — Set up iPhone PWA

1. On your iPhone, open **Safari** and navigate to your Vercel URL  
   (e.g. `https://stock-whale-tracker.vercel.app`)

2. Tap the **Share** button → **"Add to Home Screen"** → Add

3. Open the app from your home screen (must be opened from home screen, not Safari)

4. Go to **Settings** → tap **"Enable Alerts"**

5. When prompted, allow notifications — you'll now receive push alerts for whale activity on your watchlist tickers.

---

## Pre-generated credentials (already in .env.local)

These were generated for you — **do not regenerate** them after your first deploy, as changing VAPID keys will break existing push notification subscriptions.

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BJq8p6bi2MlTeSaLiv2XyHhk9JaNaSUJnCj0JmTxl9XMPHJFq4g7JmFt-xj5KBCsAc6t4Xw0-wjh8zX_l44Lav8
VAPID_PRIVATE_KEY=GEWeAK9WLaNOxWtqZdZqSq0PkHn6oLd-JC9Tw3C0k_4
CRON_SECRET=OXKvH1szWCPGqYjOqGEYNNwEdJ0A8jVExocUnZDtKNY=
```

---

## Checklist

- [ ] Supabase project created
- [ ] Both SQL migrations run
- [ ] Realtime enabled on `institutional_activity`
- [ ] Supabase user created (`gsaintaubin1224@gmail.com`)
- [ ] `.env.local` filled in (3 values from Supabase + Quiver)
- [ ] Vercel project created (`npx vercel`)
- [ ] All env vars added to Vercel dashboard
- [ ] Production deploy run (`npx vercel --prod`)
- [ ] iPhone PWA installed + alerts enabled
