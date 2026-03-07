import { TrendingUpIcon, TrendingDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ActivityRow } from "@/types/database.types";
import { formatDate, formatActorType } from "@/lib/utils/format";

interface Props {
  activity: ActivityRow[];
}

const BUY_TYPES  = ["buy", "new_position", "increase"];
const SELL_TYPES = ["sell", "decrease", "closed_position"];

export function TopMoversTable({ activity }: Props) {
  // Group by ticker — count buys AND sells, track latest date
  const tickerMap = new Map<
    string,
    { ticker: string; buys: number; sells: number; latestDate: string | null }
  >();

  for (const row of activity) {
    const isBuy  = BUY_TYPES.includes(row.activity_type);
    const isSell = SELL_TYPES.includes(row.activity_type);
    if (!isBuy && !isSell) continue;

    const existing = tickerMap.get(row.ticker);
    if (existing) {
      if (isBuy)  existing.buys++;
      if (isSell) existing.sells++;
      if (!existing.latestDate || (row.trade_date && row.trade_date > existing.latestDate)) {
        existing.latestDate = row.trade_date;
      }
    } else {
      tickerMap.set(row.ticker, {
        ticker: row.ticker,
        buys:  isBuy  ? 1 : 0,
        sells: isSell ? 1 : 0,
        latestDate: row.trade_date,
      });
    }
  }

  // Sort by total signal count (buys + sells)
  const topMovers = Array.from(tickerMap.values())
    .sort((a, b) => (b.buys + b.sells) - (a.buys + a.sells))
    .slice(0, 8);

  // Recent activity: sort by fetched_at descending (newest data first)
  const recentActivity = [...activity]
    .sort((a, b) => b.fetched_at.localeCompare(a.fetched_at))
    .slice(0, 8);

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {/* Top tickers by signal count */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-heading font-semibold tracking-wide text-foreground">
            Top Tickers
          </h3>
          <span className="text-[10px] tracking-widest uppercase text-muted-foreground">
            By Signals · 30d
          </span>
        </div>
        <div className="divide-y divide-border">
          {topMovers.map(({ ticker, buys, sells, latestDate }, i) => (
            <div
              key={ticker}
              className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors duration-100"
            >
              {/* Rank */}
              <span className="text-[11px] font-mono text-muted-foreground w-4 text-right shrink-0">
                {i + 1}
              </span>

              {/* Ticker */}
              <span className="font-mono font-bold text-sm text-foreground w-14 shrink-0">
                {ticker}
              </span>

              {/* Signal badges */}
              <div className="flex items-center gap-1.5 flex-1">
                {buys > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded tabular-nums"
                    style={{
                      background: "rgba(0, 232, 122, 0.09)",
                      color: "#00E87A",
                      border: "1px solid rgba(0, 232, 122, 0.18)",
                    }}
                  >
                    <TrendingUpIcon className="h-2.5 w-2.5 flex-shrink-0" />
                    {buys}
                  </span>
                )}
                {sells > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded tabular-nums"
                    style={{
                      background: "rgba(255, 77, 109, 0.09)",
                      color: "#FF4D6D",
                      border: "1px solid rgba(255, 77, 109, 0.18)",
                    }}
                  >
                    <TrendingDownIcon className="h-2.5 w-2.5 flex-shrink-0" />
                    {sells}
                  </span>
                )}
              </div>

              {/* Latest trade date */}
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                {formatDate(latestDate)}
              </span>
            </div>
          ))}
          {topMovers.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground text-center">
              No activity yet.
            </p>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-heading font-semibold tracking-wide text-foreground">
            Recent Activity
          </h3>
          <span className="text-[10px] tracking-widest uppercase text-muted-foreground">
            Latest signals
          </span>
        </div>
        <div className="divide-y divide-border">
          {recentActivity.map((row) => {
            const isBuy = BUY_TYPES.includes(row.activity_type);
            return (
              <div key={row.id} className="px-5 py-3 hover:bg-muted/30 transition-colors duration-100">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-bold text-sm text-foreground shrink-0">
                      {row.ticker}
                    </span>
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] font-semibold shrink-0"
                      style={{ color: isBuy ? "#00E87A" : "#FF4D6D" }}
                    >
                      {isBuy
                        ? <TrendingUpIcon className="h-3 w-3" />
                        : <TrendingDownIcon className="h-3 w-3" />
                      }
                      {isBuy ? "Buy" : "Sell"}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4 border-border text-muted-foreground shrink-0"
                    >
                      {formatActorType(row.actor_type)}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-2">
                    {formatDate(row.trade_date)}
                  </span>
                </div>
                {row.actor_name && (
                  <p className="text-[11px] text-muted-foreground truncate pl-0">
                    {row.actor_name}
                  </p>
                )}
              </div>
            );
          })}
          {recentActivity.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground text-center">
              No activity yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
