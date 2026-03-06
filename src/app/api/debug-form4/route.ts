// Temporary debug endpoint — remove after diagnosis
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const SEC_HEADERS = {
  "User-Agent": "StockWhaleTracker/1.0 debug@example.com",
  "Accept-Encoding": "gzip, deflate",
  Accept: "application/json",
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ticker = request.nextUrl.searchParams.get("ticker") ?? "NVDA";
  const daysBack = parseInt(request.nextUrl.searchParams.get("days") ?? "30");

  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  // Step 1: EFTS search
  const eftsUrl =
    `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(ticker)}%22` +
    `&forms=4&dateRange=custom&startdt=${cutoff}&enddt=${today}`;

  const eftsRes = await fetch(eftsUrl, { headers: SEC_HEADERS });
  const eftsStatus = eftsRes.status;
  const eftsData = eftsRes.ok ? await eftsRes.json() : null;

  const hits = eftsData?.hits?.hits ?? [];
  // Dump ALL keys from first hit's _source so we know the real field names
  const firstSourceAllKeys = hits[0] ? Object.keys(hits[0]._source) : [];
  const firstSourceFull = hits[0]?._source ?? null;

  const sampleHits = hits.slice(0, 3).map((h: { _source: Record<string, unknown> }) => ({
    // Try common field name variants
    accession_no: h._source.accession_no ?? h._source["accession-no"] ?? h._source.accessionNo,
    file_date: h._source.file_date ?? h._source.fileDate,
    entity_name: h._source.entity_name ?? h._source.entityName,
    period_of_report: h._source.period_of_report ?? h._source.periodOfReport,
    form_type: h._source.form_type ?? h._source.formType,
  }));

  // Step 2: For first hit, try to fetch filing index
  let indexResult = null;
  let xmlSample = null;

  if (hits.length > 0) {
    const firstHit = hits[0]._source;
    const accNo = (firstHit.accession_no as string) ?? "";
    const filerCik = accNo.split("-")[0].replace(/^0+/, "");
    const accNoDashes = accNo.replace(/-/g, "");

    const indexUrl = `https://www.sec.gov/Archives/edgar/data/${filerCik}/${accNoDashes}/${accNo}-index.json`;
    try {
      const idxRes = await fetch(indexUrl, { headers: SEC_HEADERS });
      if (idxRes.ok) {
        const idx = await idxRes.json();
        const items = idx?.directory?.item ?? [];
        indexResult = { url: indexUrl, items: items.slice(0, 5) };

        // Try fetching the first XML item
        const xmlItem = items.find(
          (it: { name: string; type: string }) =>
            it.name.endsWith(".xml") || it.type === "4"
        );
        if (xmlItem) {
          const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${filerCik}/${accNoDashes}/${xmlItem.name}`;
          const xmlRes = await fetch(xmlUrl, {
            headers: { ...SEC_HEADERS, Accept: "text/xml, */*" },
          });
          if (xmlRes.ok) {
            const xml = await xmlRes.text();
            // Return first 2000 chars of XML
            xmlSample = xml.substring(0, 2000);
          } else {
            xmlSample = `XML fetch failed: HTTP ${xmlRes.status} for ${xmlUrl}`;
          }
        }
      } else {
        indexResult = { error: `Index fetch HTTP ${idxRes.status}`, url: indexUrl };
      }
    } catch (err) {
      indexResult = { error: String(err) };
    }
  }

  return NextResponse.json({
    ticker,
    daysBack,
    cutoff,
    today,
    eftsStatus,
    totalHits: hits.length,
    firstSourceAllKeys,
    firstSourceFull,
    sampleHits,
    indexResult,
    xmlSample,
  });
}
