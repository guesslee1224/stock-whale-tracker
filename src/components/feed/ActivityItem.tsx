import { Badge } from "@/components/ui/badge";
import type { ActivityRow } from "@/types/database.types";
import { formatCents, formatDate, formatActivityType } from "@/lib/utils/format";
import { TrendingUpIcon, TrendingDownIcon, MinusIcon, ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  item: ActivityRow;
}

const sourceLabels: Record<ActivityRow["source"], string> = {
  quiver_congress: "Congress",
  quiver_insider: "Insider",
  quiver_institutional: "Institution",
  sec_13f: "13F Filing",
  house_congress: "House",
  senate_congress: "Senate",
  sec_form4: "Insider (Form 4)",
};

const sourceColors: Record<ActivityRow["source"], string> = {
  quiver_congress:    "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  quiver_insider:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
  quiver_institutional:"bg-purple-500/10 text-purple-400 border-purple-500/20",
  sec_13f:            "bg-gray-500/10 text-gray-300 border-gray-500/20",
  house_congress:     "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  senate_congress:    "bg-orange-500/10 text-orange-400 border-orange-500/20",
  sec_form4:          "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

// Extract typed fields from raw_payload (Form 4 enriched data)
interface RawPayload {
  owner_name?: string | null;
  owner_title?: string | null;
  owner_relation?: string | null;
  shares?: number | null;
  price_per_share?: number | null;
  value_usd_dollars?: number | null;
  sec_filing_url?: string | null;
  transaction_code?: string | null;
  entity_name?: string | null;        // 13F
  file_date?: string | null;          // 13F
  period_of_report?: string | null;   // 13F
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

  const Icon = isBullish ? TrendingUpIcon : isBearish ? TrendingDownIcon : MinusIcon;
  const valueColor = isBullish ? "text-green-400" : isBearish ? "text-red-400" : "text-muted-foreground";
  const raw = getRaw(item);

  // Resolve the best display name for the person/institution
  const displayName =
    item.actor_name ||
    raw.owner_name ||
    raw.entity_name ||
    null;

  // Role / title badge (e.g. "CEO", "Director")
  const roleLabel = raw.owner_title || raw.owner_relation || null;

  // Shares and price (Form 4 enriched data)
  const shares = raw.shares ?? null;
  const pricePerShare = raw.price_per_share ?? null;

  // Total value — prefer value_usd (stored in cents), fallback to raw payload dollars
  const totalValueCents =
    item.value_usd ??
    (raw.value_usd_dollars ? Math.round(raw.value_usd_dollars * 100) : null);

  // Filing URL for direct SEC link
  const filingUrl = raw.sec_filing_url ?? null;

  // Best date to show: transaction date → filing date
  const displayDate = item.trade_date ?? item.filed_date;
  const filedDateLabel =
    !item.trade_date && item.filed_date
      ? `Filed ${formatDate(item.filed_date)}`
      : null;

  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
      {/* Trend icon */}
      <div className={cn(
        "mt-0.5 shrink-0 rounded-full p-1.5",
        isBullish ? "bg-green-500/10" : isBearish ? "bg-red-500/10" : "bg-muted"
      )}>
        <Icon className={cn("h-3.5 w-3.5", valueColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">

        {/* Row 1: ticker · source badge · action · date */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm font-mono">{item.ticker}</span>
          <Badge variant="outline" className={cn("text-xs px-1.5 py-0", sourceColors[item.source])}>
            {sourceLabels[item.source]}
          </Badge>
          <span className={cn("text-xs font-semibold", valueColor)}>
            {formatActivityType(item.activity_type)}
          </span>
          {displayDate && (
            <span className="text-xs text-muted-foreground ml-auto shrink-0">
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
            <span className="text-sm font-medium text-foreground truncate max-w-[260px]">
              {displayName}
            </span>
            {roleLabel && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {roleLabel}
              </span>
            )}
            {item.actor_type && (
              <span className="text-xs text-muted-foreground capitalize opacity-70">
                · {item.actor_type}
              </span>
            )}
          </div>
        )}

        {/* Row 3: shares · price · total value · SEC link */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          {shares && (
            <span className={cn("font-medium", valueColor)}>
              {formatShares(shares)}
            </span>
          )}
          {pricePerShare && shares && <span>·</span>}
          {pricePerShare && (
            <span>{formatPrice(pricePerShare)}</span>
          )}
          {totalValueCents && (shares || pricePerShare) && <span>·</span>}
          {totalValueCents && (
            <span className={cn("font-semibold", valueColor)}>
              {formatCents(totalValueCents)} total
            </span>
          )}
          {!shares && !pricePerShare && totalValueCents && (
            <span className={cn("font-semibold", valueColor)}>
              {formatCents(totalValueCents)}
            </span>
          )}
          {filingUrl && (
            <a
              href={filingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto shrink-0 flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              SEC filing <ExternalLinkIcon className="h-3 w-3" />
            </a>
          )}
        </div>

      </div>
    </div>
  );
}
