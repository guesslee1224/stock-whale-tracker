// Congressional trading data — free public APIs, no key required
//
// House trades: housestockwatcher.com (aggregates House Clerk PTR filings)
// Senate trades: senatestockwatcher.com (aggregates Senate disclosure PTR filings)
//
// Both pull from official government disclosure portals (STOCK Act filings).
// Politicians have 45 days to report after a transaction.

const HOUSE_API = "https://housestockwatcher.com/api";
const SENATE_API = "https://senatestockwatcher.com/api/transactions";

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

export async function fetchHouseTrades(): Promise<HouseTrade[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(HOUSE_API, {
      headers: HEADERS,
      signal: controller.signal,
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`House Stock Watcher error: ${res.status}`);
    const raw = await res.json();
    // API returns array directly or wrapped in { data: [] }
    return Array.isArray(raw) ? raw : (raw.data ?? []);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSenateTrades(): Promise<SenateTrade[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(SENATE_API, {
      headers: HEADERS,
      signal: controller.signal,
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`Senate Stock Watcher error: ${res.status}`);
    const raw = await res.json();
    return Array.isArray(raw) ? raw : (raw.data ?? []);
  } finally {
    clearTimeout(timeout);
  }
}

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
  // "--" means the asset is not a publicly traded stock
  if (t === "--" || t === "" || t.length > 5) return null;
  return t;
}
