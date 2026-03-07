import type { ActivityRow } from "@/types/database.types";
import { formatCents, formatDate, formatActivityType } from "@/lib/utils/format";
import { ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  item: ActivityRow;
}

const txCodeLabels: Record<string, string> = {
  P: "Open Market Purchase",
  S: "Open Market Sale",
  A: "Award / Grant",
  G: "Gift",
  F: "Tax Withholding",
  M: "Option Exercise",
  X: "Option Exercise",
  D: "Disposed",
  I: "Discretionary",
  J: "Other",
  K: "Equity Swap",
  U: "Tender / Exchange",
  W: "Inheritance / Will",
  Z: "Trust Transfer",
};

const sourceLabels: Record<ActivityRow["source"], string> = {
  quiver_congress: "Congress",
  quiver_insider: "Insider",
  quiver_institutional: "Institution",
  sec_13f: "13F",
  house_congress: "House",
  senate_congress: "Senate",
  sec_form4: "Form 4",
};

const sourceStyles: Record<ActivityRow["source"], { color: string; bg: string }> = {
  quiver_congress:     { color: "#FFB800", bg: "rgba(255,184,0,0.08)" },
  quiver_insider:      { color: "#38BDF8", bg: "rgba(56,189,248,0.08)" },
  quiver_institutional:{ color: "#A78BFA", bg: "rgba(167,139,250,0.08)" },
  sec_13f:             { color: "#8097B4", bg: "rgba(128,151,180,0.08)" },
  house_congress:      { color: "#FFB800", bg: "rgba(255,184,0,0.08)" },
  senate_congress:     { color: "#FFA040", bg: "rgba(255,160,64,0.08)" },
  sec_form4:           { color: "#38BDF8", bg: "rgba(56,189,248,0.08)" },
};

interface RawPayload {
  owner_name?: string | null;
  owner_title?: string | null;
  owner_relation?: string | null;
  put_call?: string | null;
  shares?: number | null;
  price_per_share?: number | null;
  value_usd_dollars?: number | null;
  sec_filing_url?: string | null;
  transaction_code?: string | null;
  entity_name?: string | null;
  file_date?: string | null;
  period_of_report?: string | null;
}

function getRaw(item: ActivityRow): RawPayload {
  if (item.raw_payload && typeof item.raw_payload === "object" && !Array.isArray(item.raw_payload)) {
    return item.raw_payload as RawPayload;
  }
  return {};
}

function formatShares(n: number | null | undefined): string | null {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M shares`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K shares`;
  return `${n.toLocaleString()} shares`;
}

function formatPrice(n: number | null | undefined): string | null {
  if (!n) return null;
  return `@ $${n.toFixed(2)}`;
}

export function ActivityItem({ item }: Props) {
  const isBullish = ["buy", "new_position", "increase"].includes(item.activity_type);
  const isBearish = ["sell", "closed_position", "decrease"].includes(item.activity_type);

  const accentColor = isBullish ? "#00E87A" : isBearish ? "#FF4D6D" : "#8097B4";

  const raw = getRaw(item);

  const displayName =
    item.actor_name || raw.owner_name || raw.entity_name || null;
  const roleLabel = raw.owner_title || raw.owner_relation || null;
  const shares = raw.shares ?? null;
  const pricePerShare = raw.price_per_share ?? null;
  const totalValueCents =
    item.value_usd ??
    (raw.value_usd_dollars ? Math.round(raw.value_usd_dollars * 100) : null);
  const filingUrl = raw.sec_filing_url ?? null;
  const displayDate = item.trade_date ?? item.filed_date;
  const filedDateLabel =
    !item.trade_date && item.filed_date
      ? `Filed ${formatDate(item.filed_date)}`
      : null;

  const srcStyle = sourceStyles[item.source];

  return (
    <div
      className="flex gap-0 rounded-lg border border-border bg-card overflow-hidden hover:bg-muted/20 transition-colors duration-150 group"
      style={{ borderLeftColor: accentColor, borderLeftWidth: "2px" }}
    >
      {/* Left accent bar / type indicator */}
      <div className="flex flex-col items-center justify-start px-3 py-3.5 shrink-0">
        <span
          className="text-[10px] font-mono font-bold leading-none"
          style={{ color: accentColor }}
        >
          {isBullish ? "▲" : isBearish ? "▼" : "—"}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-3 pr-4 space-y-1">
        {/* Row 1: ticker · source badge · action · date */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-sm text-foreground tracking-wide">
            {item.ticker}
          </span>

          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ color: srcStyle.color, background: srcStyle.bg }}
          >
            {sourceLabels[item.source]}
          </span>

          <span
            className="text-[11px] font-semibold"
            style={{ color: accentColor }}
          >
            {formatActivityType(item.activity_type)}
          </span>

          {displayDate && (
            <span className="text-[11px] text-muted-foreground font-mono ml-auto shrink-0">
              {formatDate(displayDate)}
              {filedDateLabel && (
                <span className="ml-1 opacity-60">({filedDateLabel})</span>
              )}
            </span>
          )}
        </div>

        {/* Row 2: person / institution name + role */}
        {displayName && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-foreground font-medium truncate max-w-[260px]">
              {displayName}
            </span>
            {roleLabel && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {roleLabel}
              </span>
            )}
            {item.actor_type && (
              <span className="text-[11px] text-muted-foreground opacity-60 capitalize">
                · {item.actor_type}
              </span>
            )}
          </div>
        )}

        {/* Row 3: shares · price · total value · SEC link */}
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground font-mono">
          {shares && (
            <span className="font-medium" style={{ color: accentColor }}>
              {formatShares(shares)}
            </span>
          )}
          {pricePerShare && shares && <span>·</span>}
          {pricePerShare && <span>{formatPrice(pricePerShare)}</span>}
          {totalValueCents && (shares || pricePerShare) && <span>·</span>}
          {totalValueCents && (
            <span className="font-semibold" style={{ color: accentColor }}>
              {formatCents(totalValueCents)} total
            </span>
          )}
          {!shares && !pricePerShare && totalValueCents && (
            <span className="font-semibold" style={{ color: accentColor }}>
              {formatCents(totalValueCents)}
            </span>
          )}
          {raw.put_call && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{
                color: raw.put_call.toLowerCase() === "call" ? "#00E87A" : "#FF4D6D",
                background: raw.put_call.toLowerCase() === "call"
                  ? "rgba(0,232,122,0.08)"
                  : "rgba(255,77,109,0.08)",
              }}
            >
              {raw.put_call}
            </span>
          )}
          {raw.transaction_code && !pricePerShare && !totalValueCents && (
            <span className="opacity-60">
              {txCodeLabels[raw.transaction_code] ?? `Code ${raw.transaction_code}`}
            </span>
          )}
          {filingUrl && (
            <a
              href={filingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "ml-auto shrink-0 flex items-center gap-1 text-muted-foreground",
                "hover:text-foreground transition-colors duration-150"
              )}
            >
              SEC <ExternalLinkIcon className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
