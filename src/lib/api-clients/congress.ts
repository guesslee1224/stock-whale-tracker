// Congressional trading data — free public data, no API key required
//
// House trades: AWS S3 bucket (housestockwatcher project)
//   https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json
//   This S3 bucket is not IP-blocked like the housestockwatcher.com API endpoint.
//
// Senate trades: GitHub raw CDN (timothycarambat/senate-stock-watcher-data)
//   https://raw.githubusercontent.com/timothycarambat/senate-stock-watcher-data/master/all_ticker_transactions.json
//   Indexed by ticker, served via GitHub's CDN — not IP-blocked from Vercel.
//
// Both sources pull from official STOCK Act PTR government disclosure filings.
// Politicians have 45 days to report after a transaction.

const HOUSE_S3 =
  "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json";
const HOUSE_FALLBACK = "https://housestockwatcher.com/api";

const SENATE_GITHUB =
  "https://raw.githubusercontent.com/timothycarambat/senate-stock-watcher-data/master/all_ticker_transactions.json";
const SENATE_FALLBACK = "https://senatestockwatcher.com/api/transactions";

const HEADERS = {
  "User-Agent": "StockWhaleTracker/1.0 (personal finance tracker)",
  Accept: "application/json",
};

export interface HouseTrade {
  transaction_date: string;
  owner: string;
  ticker: string;
  asset_description: string;
  type: string; // "purchase" | "sale_partial" | "sale_full" | "exchange"
  amount: string; // "$1,001 - $15,000"
  representative: string;
  district: string;
  disclosure_date: string;
  ptr_link?: string;
}

export interface SenateTrade {
  transaction_date: string;
  senator: string;
  ticker: string;
  asset_type: string;
  asset_name: string;
  type: string; // "Purchase" | "Sale (Full)" | "Sale (Partial)"
  amount: string;
  comment?: string;
  disclosure_date?: string;
}

function dateCutoff(monthsBack = 12): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().split("T")[0];
}

// ── House trades ─────────────────────────────────────────────────────────────
// Primary: S3 bucket (not IP-blocked). Fallback: housestockwatcher.com/api.
export async function fetchHouseTrades(): Promise<HouseTrade[]> {
  const cutoff = dateCutoff(12);

  for (const url of [HOUSE_S3, HOUSE_FALLBACK]) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      const res = await fetch(url, {
        headers: HEADERS,
        signal: controller.signal,
        next: { revalidate: 0 },
      });
      clearTimeout(timeout);
      if (!res.ok) continue;

      const raw = await res.json();
      const all: HouseTrade[] = Array.isArray(raw) ? raw : (raw.data ?? []);
      // Filter to last 12 months to keep payload manageable
      return all.filter((t) => (t.transaction_date ?? "") >= cutoff);
    } catch {
      // try next source
    }
  }

  return [];
}

// ── Senate trades ─────────────────────────────────────────────────────────────
// Primary: GitHub raw CDN (indexed by ticker — fast and reliable from Vercel).
// Fallback: senatestockwatcher.com/api/transactions.
export async function fetchSenateTrades(): Promise<SenateTrade[]> {
  const cutoff = dateCutoff(12);

  // Try GitHub CDN first — returns { TICKER: SenateTrade[] }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    const res = await fetch(SENATE_GITHUB, {
      headers: HEADERS,
      signal: controller.signal,
      next: { revalidate: 0 },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const indexed = (await res.json()) as Record<string, SenateTrade[]>;
      // Flatten all tickers, normalise field names, filter to cutoff
      return Object.entries(indexed).flatMap(([ticker, trades]) =>
        (trades ?? []).map((t) => ({ ...t, ticker: ticker.toUpperCase() }))
      ).filter((t) => (t.transaction_date ?? "") >= cutoff);
    }
  } catch {
    // fall through to fallback
  }

  // Fallback: direct API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(SENATE_FALLBACK, {
      headers: HEADERS,
      signal: controller.signal,
      next: { revalidate: 0 },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const raw = await res.json();
    const all: SenateTrade[] = Array.isArray(raw) ? raw : (raw.data ?? []);
    return all.filter((t) => (t.transaction_date ?? "") >= cutoff);
  } catch {
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Parse "$1,001 - $15,000" style range strings → midpoint in cents
export function parseAmountRange(amountStr: string | undefined | null): number | null {
  if (!amountStr) return null;
  const cleaned = amountStr.replace(/[$,]/g, "");
  const parts = cleaned.split(/\s*[-–]\s*/);
  if (parts.length === 2) {
    const low = parseFloat(parts[0]);
    const high = parseFloat(parts[1]);
    if (!isNaN(low) && !isNaN(high)) {
      return Math.round(((low + high) / 2) * 100);
    }
  }
  const single = parseFloat(cleaned);
  return isNaN(single) ? null : Math.round(single * 100);
}

export function isHousePurchase(type: string): boolean {
  return type.toLowerCase().includes("purchase");
}

export function isSenatePurchase(type: string): boolean {
  return type.toLowerCase().includes("purchase");
}

// Normalize tickers — some filings use "$NVDA", "--" (non-stock), etc.
export function normalizeTicker(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const t = raw.trim().replace(/^\$/, "").toUpperCase();
  if (t === "--" || t === "" || t.length > 5) return null;
  return t;
}
