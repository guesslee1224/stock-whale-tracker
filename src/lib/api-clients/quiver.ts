// Quiver Quantitative API client
// Docs: https://www.quiverquant.com/sources/
// Requires QUIVER_API_KEY in environment variables ($10/month plan)

const QUIVER_BASE = "https://api.quiverquant.com/beta";

function quiverHeaders() {
  return {
    Authorization: `Token ${process.env.QUIVER_API_KEY}`,
    Accept: "application/json",
  };
}

async function quiverFetch(path: string) {
  const res = await fetch(`${QUIVER_BASE}${path}`, {
    headers: quiverHeaders(),
    next: { revalidate: 0 }, // Always fetch fresh data in cron context
  });

  if (res.status === 429) {
    throw new Error(`Quiver rate limit hit for ${path}`);
  }
  if (!res.ok) {
    throw new Error(`Quiver API error ${res.status} for ${path}`);
  }
  return res.json();
}

// ── Congressional trading ─────────────────────────────────────────────────
// Returns trades filed by US Congress members for a given ticker.
// Fields: Transaction (Purchase/Sale), Amount, Representative, TransactionDate, ReportDate, etc.
export async function fetchCongressTrades(ticker: string) {
  return quiverFetch(`/historical/congresstrading/${ticker}`);
}

// ── Insider trading ───────────────────────────────────────────────────────
// Returns SEC Form 4 insider trades (executives, directors) for a ticker.
// Fields: Name, AcquisitionDisposition (A/D), TransactionCode, Shares, PricePerShare, etc.
export async function fetchInsiderTrades(ticker: string) {
  return quiverFetch(`/historical/insiders/${ticker}`);
}

// ── Institutional ownership (13F) ─────────────────────────────────────────
// Returns institutional holdings from quarterly 13F filings for a ticker.
// Fields: InstitutionName, Shares, Value, PercentageShares, etc.
export async function fetchInstitutionalOwnership(ticker: string) {
  return quiverFetch(`/historical/institutionalownership/${ticker}`);
}

// ── Helper: parse Quiver's range-based dollar amount strings ──────────────
// Congressional filings report amounts as ranges like "$1,001 - $15,000"
// Returns the midpoint in cents.
export function parseCongressAmount(amountStr: string | undefined): number | null {
  if (!amountStr) return null;

  // Remove $ and commas, split on " - "
  const cleaned = amountStr.replace(/[$,]/g, "");
  const parts = cleaned.split(/\s*[-–]\s*/);

  if (parts.length === 2) {
    const low = parseFloat(parts[0]);
    const high = parseFloat(parts[1]);
    if (!isNaN(low) && !isNaN(high)) {
      return Math.round(((low + high) / 2) * 100); // midpoint in cents
    }
  }

  const single = parseFloat(cleaned);
  return isNaN(single) ? null : Math.round(single * 100);
}
