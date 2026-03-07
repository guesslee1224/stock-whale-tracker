import { Badge } from "@/components/ui/badge";
import type { ActivityRow } from "@/types/database.types";
import { formatCents, formatDate, formatActorType } from "@/lib/utils/format";

interface Props {
  activity: ActivityRow[];
}

export function TopMoversTable({ activity }: Props) {
  // Group by ticker, sum buy volume
  const tickerMap = new Map<string, { ticker: string; totalValue: number; count: number; latestDate: string | null }>();

  for (const row of activity) {
    if (!["buy", "new_position", "increase"].includes(row.activity_type)) continue;
    const existing = tickerMap.get(row.ticker);
    if (existing) {
      existing.totalValue += row.value_usd ?? 0;
      existing.count++;
      if (!existing.latestDate || (row.trade_date && row.trade_date > existing.latestDate)) {
        existing.latestDate = row.trade_date;
      }
    } else {
      tickerMap.set(row.ticker, {
        ticker: row.ticker,
        totalValue: row.value_usd ?? 0,
        count: 1,
        latestDate: row.trade_date,
      });
    }
  }

  const topMovers = Array.from(tickerMap.values())
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 8);

  const recentActivity = [...activity]
    .sort((a, b) => (b.trade_date ?? "").localeCompare(a.trade_date ?? ""))
    .slice(0, 5);

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {/* Top tickers by buy volume */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-heading font-semibold tracking-wide text-foreground">
            Top Tickers
          </h3>
          <span className="text-[10px] tracking-widest uppercase text-muted-foreground">
            By Volume · 30d
          </span>
        </div>
        <div className="divide-y divide-border">
          {topMovers.map(({ ticker, totalValue, count }, i) => (
            <div
              key={ticker}
              className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors duration-100"
            >
              <span className="text-[11px] font-mono text-muted-foreground w-5 text-right shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 flex items-center gap-2.5 min-w-0">
                <span className="font-mono font-bold text-sm text-foreground">{ticker}</span>
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(56, 189, 248, 0.08)", color: "#38BDF8" }}
                >
                  {count}×
                </span>
              </div>
              <span className="font-mono text-sm font-semibold shrink-0" style={{ color: "#00E87A" }}>
                {formatCents(totalValue)}
              </span>
            </div>
          ))}
          {topMovers.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground text-center">
              No buy activity yet.
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
          <span className="flex items-center gap-1.5 text-[10px] tracking-widest uppercase" style={{ color: "#00E87A" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#00E87A", boxShadow: "0 0 5px #00E87A" }} />
            Live
          </span>
        </div>
        <div className="divide-y divide-border">
          {recentActivity.map((row) => {
            const isBull = ["buy", "new_position", "increase"].includes(row.activity_type);
            return (
              <div key={row.id} className="px-5 py-3 hover:bg-muted/30 transition-colors duration-100">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-foreground">{row.ticker}</span>
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: isBull ? "#00E87A" : "#FF4D6D" }}
                    >
                      {isBull ? "▲" : "▼"}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {formatDate(row.trade_date)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border text-muted-foreground">
                    {formatActorType(row.actor_type)}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {row.actor_name}
                  </span>
                </div>
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
