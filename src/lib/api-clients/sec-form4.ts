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

// ─── EDGAR EFTS search for Form 4 by issuer ticker ───────────────────────────
// Form 4 filings are filed by the REPORTING OWNER (insider), not the company.
// They are indexed in EDGAR under the owner's CIK, not the issuer's CIK.
// The correct way to find Form 4s for a company is via full-text search
// (EFTS), which searches the filing content including the issuer's ticker.
//
// The accession number encodes the filer/owner CIK in its first 10 digits:
//   "0000950170-25-007241" → filer CIK = "950170"
interface RecentFiling {
  accessionNumber: string;
  filerCik: string;    // reporting owner CIK (from accession number)
  filingDate: string;
  reportDate: string;
  entityName: string | null; // reporting owner name (from EFTS)
}

async function getRecentForm4Filings(ticker: string, daysBack = 21): Promise<RecentFiling[]> {
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  // EFTS full-text search: finds Form 4 filings that mention the ticker as issuer
  const url =
    `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(ticker)}%22` +
    `&forms=4&dateRange=custom&startdt=${cutoff}&enddt=${today}`;

  const res = await fetch(url, { headers: SEC_HEADERS, next: { revalidate: 0 } });
  if (!res.ok) return [];

  const data = await res.json();
  const hits: Array<{ _source: Record<string, unknown> }> = data?.hits?.hits ?? [];

  return hits
    .map((hit) => {
      const src = hit._source;
      // EFTS Form 4 fields (different from 13F):
      //   adsh          = accession number with dashes (e.g. "0001283854-26-000002")
      //   ciks[0]       = reporting owner CIK (e.g. "0001283854")
      //   display_names = ["Owner Name  (CIK 0001283854)", "ISSUER CORP  (CIK 0001045810)"]
      //   period_ending = transaction/report date
      const accNo = (src.adsh as string | undefined) ?? "";
      if (!accNo) return null;

      // Filer CIK from ciks array (first entry is the reporting owner)
      const ciks = src.ciks as string[] | undefined;
      const filerCikRaw = ciks?.[0] ?? accNo.split("-")[0];
      const filerCik = filerCikRaw.replace(/^0+/, "");

      // Insider name from display_names[0]: "Shoquist Debora  (CIK 0001283854)"
      const displayNames = src.display_names as string[] | undefined;
      const rawName = displayNames?.[0] ?? "";
      const entityName = rawName.split(/\s*\(CIK/)[0].trim() || null;

      return {
        accessionNumber: accNo,
        filerCik,
        filingDate: (src.file_date as string | undefined) ?? "",
        reportDate: (src.period_ending as string | undefined) ?? "",
        entityName,
      };
    })
    .filter((f): f is RecentFiling => f !== null && !!f.filerCik);
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
// Returns ALL non-derivative transactions (acquisitions + disposals) in the filing
function parseForm4Xml(
  xml: string,
  accessionNumber: string,
  cikStr: string,
  filingDate: string
): Form4Transaction[] {
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

  // Extract all nonDerivativeTransaction blocks (buys AND sells)
  const nonDerivBlock = extractXmlBlock(xml, "nonDerivativeTable") ?? "";
  const txBlocks = extractAllXmlBlocks(nonDerivBlock, "nonDerivativeTransaction");

  const results: Form4Transaction[] = [];

  for (const tx of txBlocks) {
    const adCode = extractXmlValue(tx, "transactionAcquiredDisposedCode");
    // Only process clear acquisitions (A) or disposals (D)
    if (adCode !== "A" && adCode !== "D") continue;

    const code = extractXmlValue(tx, "transactionCode");
    const sharesStr = extractXmlValue(tx, "transactionShares");
    const priceStr = extractXmlValue(tx, "transactionPricePerShare");
    const dateStr = extractXmlValue(tx, "transactionDate");

    const shares = sharesStr ? parseFloat(sharesStr) : NaN;
    if (isNaN(shares) || shares <= 0) continue;

    const pricePerShare = priceStr ? parseFloat(priceStr) : null;
    const valueUsd =
      pricePerShare && !isNaN(pricePerShare) ? shares * pricePerShare : null;

    results.push({
      ownerName,
      ownerTitle: officerTitle,
      ownerRelation,
      transactionDate: dateStr,
      filingDate,
      shares,
      pricePerShare: pricePerShare && !isNaN(pricePerShare) ? pricePerShare : null,
      valueUsd,
      acquiredDisposed: adCode as "A" | "D",
      transactionCode: code,
      accessionNumber,
      secFilingUrl,
    });
  }

  return results;
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

  let recentFilings: RecentFiling[] = [];
  try {
    recentFilings = await getRecentForm4Filings(ticker, daysBack);
  } catch (err) {
    return {
      transactions: [],
      errors: [`EFTS search failed for ${ticker}: ${String(err)}`],
    };
  }

  if (!recentFilings.length) {
    return { transactions: [], errors: [] };
  }

  const transactions: Form4Transaction[] = [];

  // Cap at 10 filings per ticker to stay within Vercel 60s timeout
  for (const filing of recentFilings.slice(0, 10)) {
    await delay(250); // stay under SEC 10 req/sec limit
    try {
      const accNoDashes = filing.accessionNumber.replace(/-/g, "");

      // Fetch the complete EDGAR submission text file — this ALWAYS exists for any
      // filing and contains all documents (including the Form 4 XML) embedded within it.
      // Avoids needing to guess the primary document filename.
      const submissionUrl = `https://www.sec.gov/Archives/edgar/data/${filing.filerCik}/${accNoDashes}/${filing.accessionNumber}.txt`;
      const txtRes = await fetch(submissionUrl, {
        headers: XML_HEADERS,
        next: { revalidate: 0 },
      });
      if (!txtRes.ok) {
        errors.push(`Submission ${filing.accessionNumber}: HTTP ${txtRes.status}`);
        continue;
      }
      const txt = await txtRes.text();

      // Extract the <ownershipDocument> XML block from within the submission file
      const ownershipMatch = txt.match(/<ownershipDocument[\s\S]*?<\/ownershipDocument>/i);
      const xml = ownershipMatch ? ownershipMatch[0] : txt;
      const parsed = parseForm4Xml(xml, filing.accessionNumber, filing.filerCik, filing.filingDate);
      // parsed is now an array — may contain multiple transactions per filing
      for (const tx of parsed) {
        if (!tx.transactionDate && filing.reportDate)
          tx.transactionDate = filing.reportDate;
        // Use entityName from EFTS as fallback for ownerName if XML parse missed it
        if (!tx.ownerName && filing.entityName)
          tx.ownerName = filing.entityName;
        transactions.push(tx);
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
