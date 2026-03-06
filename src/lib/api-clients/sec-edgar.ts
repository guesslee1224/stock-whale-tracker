// SEC EDGAR API client
// Completely free, no API key required.
// Rate limit: 10 requests/second. Include a User-Agent header.
// Docs: https://www.sec.gov/search-filings/edgar-application-programming-interfaces

const SEC_USER_AGENT =
  process.env.VAPID_EMAIL?.replace("mailto:", "") ??
  "StockWhaleTracker/1.0 hello@example.com";

const SEC_HEADERS = {
  "User-Agent": `StockWhaleTracker/1.0 ${SEC_USER_AGENT}`,
  "Accept-Encoding": "gzip, deflate",
};

// ── CIK lookup ────────────────────────────────────────────────────────────
// Returns the SEC CIK number for a given ticker symbol (zero-padded to 10 digits).
// The company_tickers.json is a bulk file — cache it locally if calling frequently.
let tickerToCikCache: Record<string, string> | null = null;

export async function getCIKForTicker(ticker: string): Promise<string | null> {
  if (!tickerToCikCache) {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: SEC_HEADERS,
      next: { revalidate: 86400 }, // Cache for 24 hours — this file rarely changes
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as Record<
      string,
      { cik_str: number; ticker: string; title: string }
    >;

    tickerToCikCache = {};
    for (const entry of Object.values(raw)) {
      tickerToCikCache[entry.ticker.toUpperCase()] = String(entry.cik_str).padStart(10, "0");
    }
  }

  return tickerToCikCache[ticker.toUpperCase()] ?? null;
}

// ── Recent 13F filings for a CIK ─────────────────────────────────────────
// Returns the most recent submissions/filings for any CIK.
// We filter for 13F-HR (institutional investment manager quarterly reports).
export async function getRecentFilings(cik: string) {
  const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: SEC_HEADERS,
    next: { revalidate: 3600 }, // Cache for 1 hour
  });
  if (!res.ok) return null;
  return res.json();
}

// ── 13F filing index for a specific accession number ─────────────────────
export async function getFilingIndex(cik: string, accessionNumber: string) {
  // Accession number format: 0001234567-23-000001 → 0001234567-23-000001 (keep dashes for path)
  const accPath = accessionNumber.replace(/-/g, "");
  const res = await fetch(
    `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR&dateb=&owner=include&count=10&search_text=`,
    { headers: SEC_HEADERS }
  );
  if (!res.ok) return null;
  return res.text();
}

// ── Parse institutional ownership from EDGAR full-text search ─────────────
// Searches for recent 13F filings mentioning a specific ticker CUSIP/name.
export async function searchEdgarFor13F(ticker: string) {
  const res = await fetch(
    `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(ticker)}%22&dateRange=custom&startdt=${getDateMonthsAgo(4)}&enddt=${getTodayDate()}&forms=13F-HR`,
    { headers: SEC_HEADERS, next: { revalidate: 3600 } }
  );
  if (!res.ok) return null;
  return res.json();
}

function getDateMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split("T")[0];
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}
