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

const XML_HEADERS = {
  "User-Agent": `StockWhaleTracker/1.0 ${SEC_USER_AGENT}`,
  "Accept-Encoding": "gzip, deflate",
  Accept: "text/xml, application/xml, */*",
};

// ── CIK + title lookup ─────────────────────────────────────────────────────
let tickerToCikCache: Record<string, string> | null = null;
let tickerToTitleCache: Record<string, string> | null = null;

async function populateTickers() {
  if (tickerToCikCache) return;
  const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: SEC_HEADERS,
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    tickerToCikCache = {};
    tickerToTitleCache = {};
    return;
  }
  const raw = (await res.json()) as Record<
    string,
    { cik_str: number; ticker: string; title: string }
  >;
  tickerToCikCache = {};
  tickerToTitleCache = {};
  for (const entry of Object.values(raw)) {
    const t = entry.ticker.toUpperCase();
    tickerToCikCache[t] = String(entry.cik_str).padStart(10, "0");
    tickerToTitleCache[t] = entry.title;
  }
}

export async function getCIKForTicker(ticker: string): Promise<string | null> {
  await populateTickers();
  return tickerToCikCache![ticker.toUpperCase()] ?? null;
}

export async function getCompanyTitleForTicker(ticker: string): Promise<string | null> {
  await populateTickers();
  return tickerToTitleCache![ticker.toUpperCase()] ?? null;
}

// ── Recent 13F filings for a CIK ─────────────────────────────────────────
export async function getRecentFilings(cik: string) {
  const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: SEC_HEADERS,
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return res.json();
}

// ── 13F filing index for a specific accession number ─────────────────────
export async function getFilingIndex(cik: string, accessionNumber: string) {
  const accPath = accessionNumber.replace(/-/g, "");
  const res = await fetch(
    `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR&dateb=&owner=include&count=10&search_text=`,
    { headers: SEC_HEADERS }
  );
  if (!res.ok) return null;
  return res.text();
}

// ── Parse institutional ownership from EDGAR full-text search ─────────────
export async function searchEdgarFor13F(ticker: string) {
  const res = await fetch(
    `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(ticker)}%22&dateRange=custom&startdt=${getDateMonthsAgo(4)}&enddt=${getTodayDate()}&forms=13F-HR`,
    { headers: SEC_HEADERS, next: { revalidate: 3600 } }
  );
  if (!res.ok) return null;
  return res.json();
}

// ── 13F position detail: parse information table XML ──────────────────────
// Fetches the actual 13F XML document for a filing and finds the specific
// holding entry for our ticker by matching the company name.
// Returns shares held, market value, and put/call type (for options).

export interface ThirteenFPosition {
  shares: number;
  valueCents: number; // market value in cents (13F reports in thousands USD)
  putCall: string | null;
}

export async function fetch13FPositionForTicker(
  accessionNumber: string,
  filerCik: string,
  companyTitle: string
): Promise<ThirteenFPosition | null> {
  try {
    const accNoDashes = accessionNumber.replace(/-/g, "");
    const cikNum = parseInt(filerCik, 10);

    // Step 1: Fetch the filing index page to find the information table filename
    const infoTableUrl = await get13FInfoTableUrl(accNoDashes, cikNum, accessionNumber);
    if (!infoTableUrl) return null;

    // Step 2: Fetch just the information table XML
    const res = await fetch(infoTableUrl, { headers: XML_HEADERS, next: { revalidate: 0 } });
    if (!res.ok) return null;

    const xml = await res.text();
    return parseInfoTableForTicker(xml, companyTitle);
  } catch {
    return null;
  }
}

// Fetches the filing index page and extracts the information table document URL.
async function get13FInfoTableUrl(
  accNoDashes: string,
  cikNum: number,
  accessionNumber: string
): Promise<string | null> {
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDashes}/${accessionNumber}-index.htm`;
  const res = await fetch(indexUrl, { headers: SEC_HEADERS, next: { revalidate: 0 } });
  if (!res.ok) return null;

  const html = await res.text();

  // Find a link to an xml file identified as the information table.
  // Pattern 1: text "INFORMATION TABLE" followed closely by an <a href="...xml"> link
  const m1 = html.match(/INFORMATION TABLE[\s\S]{0,400}?href="([^"]+\.xml)"/i);
  // Pattern 2: href matching common info table filenames
  const m2 = html.match(/href="([^"]*(?:infotable|infoTable|InfoTable|13fInfo)[^"]*\.xml)"/i);

  const match = m1 ?? m2;
  if (!match) return null;

  const href = match[1];
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `https://www.sec.gov${href}`;
  return `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDashes}/${href}`;
}

// Parses the <informationTable> XML and finds the entry matching companyTitle.
function parseInfoTableForTicker(
  xml: string,
  companyTitle: string
): ThirteenFPosition | null {
  // Locate the <informationTable> block (the XML may be the whole document or embedded)
  const tableMatch = xml.match(/<informationTable[\s\S]*?<\/informationTable>/i);
  const tableXml = tableMatch ? tableMatch[0] : xml;

  const matchKey = getNameMatchKey(companyTitle);
  if (!matchKey) return null;

  // Extract all <infoTable> entries
  const entryRe = /<infoTable[\s\S]*?<\/infoTable>/gi;
  const entries = [...tableXml.matchAll(entryRe)].map((m) => m[0]);

  for (const entry of entries) {
    const nameMatch = entry.match(/<nameOfIssuer[^>]*>([^<]+)<\/nameOfIssuer>/i);
    if (!nameMatch) continue;

    const issuerKey = getNameMatchKey(nameMatch[1]);
    if (issuerKey !== matchKey) continue;

    // Found our ticker — extract position data
    const sharesRaw = entry.match(/<sshPrnamt[^>]*>([^<]+)<\/sshPrnamt>/i)?.[1]?.trim();
    const valueRaw = entry.match(/<value[^>]*>([^<]+)<\/value>/i)?.[1]?.trim();
    const putCallRaw = entry.match(/<putCall[^>]*>([^<]+)<\/putCall>/i)?.[1]?.trim();

    const shares = sharesRaw ? parseInt(sharesRaw, 10) : 0;
    // 13F value is in thousands of USD; convert to cents (*100,000)
    const valueThousands = valueRaw ? parseInt(valueRaw, 10) : 0;

    return {
      shares: isNaN(shares) ? 0 : shares,
      valueCents: isNaN(valueThousands) ? 0 : valueThousands * 100_000,
      putCall: putCallRaw ?? null,
    };
  }

  return null;
}

// Reduce a company name to its first "significant" word for fuzzy matching.
// e.g. "NVIDIA CORP" → "NVIDIA", "Apple Inc." → "APPLE"
function getNameMatchKey(name: string): string {
  const normalized = name.toUpperCase().replace(/[^A-Z0-9\s]/g, "").trim();
  const stopWords = new Set([
    "THE", "A", "AN", "INC", "CORP", "CORPORATION", "CO", "LTD",
    "LLC", "LP", "PLC", "GROUP", "HOLDINGS", "INTERNATIONAL", "COM",
    "COMPANY", "TECHNOLOGIES", "TECHNOLOGY", "INDUSTRIES", "GLOBAL",
  ]);
  const words = normalized.split(/\s+/).filter((w) => w.length > 1 && !stopWords.has(w));
  return words[0] ?? "";
}

function getDateMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split("T")[0];
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}
