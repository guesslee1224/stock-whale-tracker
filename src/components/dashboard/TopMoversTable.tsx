import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="grid md:grid-cols-2 gap-4">
      {/* Top tickers by buy volume */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Top Tickers by Volume</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {topMovers.map(({ ticker, totalValue, count }) => (
              <div key={ticker} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm font-mono">{ticker}</span>
                  <Badge variant="secondary" className="text-xs">
                    {count} trade{count > 1 ? "s" : ""}
                  </Badge>
                </div>
                <span className="text-sm font-medium text-green-400">
                  {formatCents(totalValue)}
                </span>
              </div>
            ))}
            {topMovers.length === 0 && (
              <p className="px-6 py-4 text-sm text-muted-foreground">
                No buy activity yet. Add tickers to your watchlist.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {recentActivity.map((row) => (
              <div key={row.id} className="px-6 py-3 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm font-mono">{row.ticker}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(row.trade_date)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {formatActorType(row.actor_type)}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">
                    {row.actor_name}
                  </span>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <p className="px-6 py-4 text-sm text-muted-foreground">
                No activity yet. Cron jobs will populate this once configured.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
