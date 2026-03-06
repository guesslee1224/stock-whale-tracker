// SEC EDGAR Form 4 client — insider trade filings
// Completely free, no API key required.
// Form 4 = "Statement of Changes in Beneficial Ownership"
//   Filed by: company officers, directors, and 10%+ shareholders
//   Deadline: within 2 business days of transaction
//
// Docs: https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=4

const SEC_USER_AGENT =
  process.env.VAPID_EMAIL?.replace("mailto:", "") ?? "StockWhaleTracker/1.0 contact@example.com";

const SEC_HEADERS = {
  "User-Agent": `StockWhaleTracker/1.0 ${SEC_USER_AGENT}`,
  "Accept-Encoding": "gzip, deflate",
  Accept: "application/json",
};

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export interface Form4Hit {
  _source: {
    entity_name?: string;       // Insider's name / company name
    file_date?: string;          // When filed with SEC
    period_of_report?: string;   // Transaction date
    accession_no?: string;
    [key: string]: unknown;
  };
}

// Search SEC EDGAR full-text search for Form 4 filings mentioning a ticker.
// Looks back 21 days — Form 4s must be filed within 2 business days so
// anything older is already in the DB from a previous run.
export async function searchForm4ForTicker(ticker: string): Promise<Form4Hit[]> {
  const url =
    `https://efts.sec.gov/LATEST/search-index` +
    `?q=%22${encodeURIComponent(ticker)}%22` +
    `&forms=4` +
    `&dateRange=custom` +
    `&startdt=${getDateDaysAgo(21)}` +
    `&enddt=${today()}`;

  const res = await fetch(url, {
    headers: SEC_HEADERS,
    next: { revalidate: 0 },
  });

  if (res.status === 429) throw new Error(`SEC rate limit hit for Form 4 / ${ticker}`);
  if (!res.ok) throw new Error(`SEC Form 4 error ${res.status} for ${ticker}`);

  const data = await res.json();
  return data?.hits?.hits ?? [];
}
