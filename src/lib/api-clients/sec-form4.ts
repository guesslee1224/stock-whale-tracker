// SEC EDGAR Form 4 client — insider trade filings (enriched version)
// Uses EDGAR submissions API + actual XML parsing for full transaction detail.
//
// Pipeline per ticker:
//   1. Look up company CIK via company_tickers.json
//   2. GET data.sec.gov/submissions/CIK{cik}.json → recent Form 4 filing list
//   3. For each recent Form 4, GET the actual XML from Archives
//   4. Parse XML → owner name, title, shares, price, transaction type
//
// Docs: https://www.sec.gov/search-filings/edgar-application-programming-interfaces

const SEC_USER_AGENT =
  process.env.VAPID_EMAIL?.replace("mailto:", "") ?? "StockWhaleTracker/1.0 contact@example.com";

const SEC_HEADERS = {
  "User-Agent": `StockWhaleTracker/1.0 ${SEC_USER_AGENT}`,
  "Accept-Encoding": "gzip, deflate",
  Accept: "application/json",
};

const XML_HEADERS = {
  "User-Agent": `StockWhaleTracker/1.0 ${SEC_USER_AGENT}`,
  "Accept-Encoding": "gzip, deflate",
  Accept: "text/xml, application/xml, */*",
};

// ─── CIK lookup (cached) ──────────────────────────────────────────────────────
let tickerToCikCache: Record<string, string> | null = null;

async function getCIKForTicker(ticker: string): Promise<string | null> {
  if (!tickerToCikCache) {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: SEC_HEADERS,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const raw = (await res.json()) as Record<string, { cik_str: number; ticker: string }>;
    tickerToCikCache = {};
    for (const entry of Object.values(raw)) {
      tickerToCikCache[entry.ticker.toUpperCase()] = String(entry.cik_str).padStart(10, "0");
    }
  }
  return tickerToCikCache[ticker.toUpperCase()] ?? null;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Form4Transaction {
  ownerName: string | null;
  ownerTitle: string | null;
  ownerRelation: string | null;
  transactionDate: string | null;
  filingDate: string | null;
  shares: number | null;
  pricePerShare: number | null;
  valueUsd: number | null;
  acquiredDisposed: "A" | "D" | null;
  transactionCode: string | null;
  accessionNumber: string;
  secFilingUrl: string;
}

// ─── EDGAR submissions API ────────────────────────────────────────────────────
interface RecentFiling {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  primaryDocument: string;
}

async function getRecentForm4Filings(cik: string, daysBack = 21): Promise<RecentFiling[]> {
  const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: SEC_HEADERS,
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];

  const data = await res.json();
  const recent = data?.filings?.recent;
  if (!recent?.form) return [];

  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const results: RecentFiling[] = [];
  for (let i = 0; i < recent.form.length; i++) {
    if (recent.form[i] === "4" && recent.filingDate[i] >= cutoff) {
      results.push({
        accessionNumber: recent.accessionNumber[i],
        filingDate: recent.filingDate[i],
        reportDate: recent.reportDate[i] ?? "",
        primaryDocument: recent.primaryDocument[i] ?? "",
      });
    }
  }
  return results;
}

// ─── XML helpers ──────────────────────────────────────────────────────────────
function extractXmlValue(xml: string, tag: string): string | null {
  const re = new RegExp(
    `<${tag}[^>]*>\\s*(?:<value[^>]*>)?([^<]+?)(?:</value>)?\\s*</${tag}>`,
    "i"
  );
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function extractXmlBlock(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1] : null;
}

function extractAllXmlBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  return [...xml.matchAll(re)].map((m) => m[1]);
}

// ─── Form 4 XML parser ────────────────────────────────────────────────────────
function parseForm4Xml(
  xml: string,
  accessionNumber: string,
  cikStr: string,
  filingDate: string
): Form4Transaction | null {
  const cikNum = parseInt(cikStr, 10);
  const accNoDashes = accessionNumber.replace(/-/g, "");
  const secFilingUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDashes}/`;

  // Owner details
  const ownerBlock = extractXmlBlock(xml, "reportingOwner") ?? "";
  const ownerName = extractXmlValue(ownerBlock, "rptOwnerName");
  const officerTitle = extractXmlValue(ownerBlock, "officerTitle");
  const isDirector = extractXmlValue(ownerBlock, "isDirector") === "1";
  const isOfficer = extractXmlValue(ownerBlock, "isOfficer") === "1";
  const isTenPct = extractXmlValue(ownerBlock, "isTenPercentOwner") === "1";
  const ownerRelation = isOfficer
    ? "Officer"
    : isDirector
    ? "Director"
    : isTenPct
    ? "10% Owner"
    : "Insider";

  // Extract all nonDerivativeTransaction blocks, look for acquisitions
  const nonDerivBlock = extractXmlBlock(xml, "nonDerivativeTable") ?? "";
  const txBlocks = extractAllXmlBlocks(nonDerivBlock, "nonDerivativeTransaction");

  for (const tx of txBlocks) {
    const adCode = extractXmlValue(tx, "transactionAcquiredDisposedCode");
    if (adCode !== "A") continue;

    const code = extractXmlValue(tx, "transactionCode");
    const sharesStr = extractXmlValue(tx, "transactionShares");
    const priceStr = extractXmlValue(tx, "transactionPricePerShare");
    const dateStr = extractXmlValue(tx, "transactionDate");

    const shares = sharesStr ? parseFloat(sharesStr) : NaN;
    if (isNaN(shares) || shares <= 0) continue;

    const pricePerShare = priceStr ? parseFloat(priceStr) : null;
    const valueUsd =
      pricePerShare && !isNaN(pricePerShare) ? shares * pricePerShare : null;

    return {
      ownerName,
      ownerTitle: officerTitle,
      ownerRelation,
      transactionDate: dateStr,
      filingDate,
      shares,
      pricePerShare: pricePerShare && !isNaN(pricePerShare) ? pricePerShare : null,
      valueUsd,
      acquiredDisposed: "A",
      transactionCode: code,
      accessionNumber,
      secFilingUrl,
    };
  }

  return null; // no acquisitions found
}

// ─── Main export ──────────────────────────────────────────────────────────────
export interface EnrichedForm4Result {
  transactions: Form4Transaction[];
  errors: string[];
}

export async function getEnrichedForm4Transactions(
  ticker: string,
  daysBack = 21
): Promise<EnrichedForm4Result> {
  const errors: string[] = [];

  const cik = await getCIKForTicker(ticker);
  if (!cik) return { transactions: [], errors: [`No CIK for ${ticker}`] };

  const cikNum = parseInt(cik, 10);
  let recentFilings: RecentFiling[] = [];
  try {
    recentFilings = await getRecentForm4Filings(cik, daysBack);
  } catch (err) {
    return {
      transactions: [],
      errors: [`Submissions fetch failed for ${ticker}: ${String(err)}`],
    };
  }

  const transactions: Form4Transaction[] = [];

  // Cap at 10 filings per ticker to stay within Vercel 60s timeout
  for (const filing of recentFilings.slice(0, 10)) {
    await delay(250); // stay under SEC 10 req/sec limit
    try {
      const accNoDashes = filing.accessionNumber.replace(/-/g, "");
      const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDashes}/${filing.primaryDocument}`;
      const xmlRes = await fetch(xmlUrl, {
        headers: XML_HEADERS,
        next: { revalidate: 0 },
      });
      if (!xmlRes.ok) {
        errors.push(`XML ${filing.accessionNumber}: HTTP ${xmlRes.status}`);
        continue;
      }
      const xml = await xmlRes.text();
      const parsed = parseForm4Xml(xml, filing.accessionNumber, cik, filing.filingDate);
      if (parsed) {
        if (!parsed.transactionDate && filing.reportDate)
          parsed.transactionDate = filing.reportDate;
        transactions.push(parsed);
      }
    } catch (err) {
      errors.push(`Parse ${filing.accessionNumber}: ${String(err)}`);
    }
  }

  return { transactions, errors };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
