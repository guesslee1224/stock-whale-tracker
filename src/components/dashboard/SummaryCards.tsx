import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUpIcon, UsersIcon, ActivityIcon, BellIcon } from "lucide-react";
import type { ActivityRow } from "@/types/database.types";
import { formatCents } from "@/lib/utils/format";

interface Props {
  activity: ActivityRow[];
  alertsSentToday: number;
}

export function SummaryCards({ activity, alertsSentToday }: Props) {
  const buyActivity = activity.filter((a) =>
    ["buy", "new_position", "increase"].includes(a.activity_type)
  );

  const totalValue = buyActivity.reduce(
    (sum, a) => sum + (a.value_usd ?? 0),
    0
  );

  const uniqueTickers = new Set(buyActivity.map((a) => a.ticker)).size;

  const congressCount = activity.filter((a) => a.actor_type === "congress").length;

  const cards = [
    {
      title: "Total Buy Volume",
      value: formatCents(totalValue),
      description: "Last 30 days across all sources",
      icon: TrendingUpIcon,
      color: "text-green-400",
    },
    {
      title: "Active Tickers",
      value: uniqueTickers.toString(),
      description: "Stocks with whale activity",
      icon: ActivityIcon,
      color: "text-blue-400",
    },
    {
      title: "Congress Trades",
      value: congressCount.toString(),
      description: "Congressional buy trades tracked",
      icon: UsersIcon,
      color: "text-yellow-400",
    },
    {
      title: "Alerts Sent",
      value: alertsSentToday.toString(),
      description: "Push notifications today",
      icon: BellIcon,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ title, value, description, icon: Icon, color }) => (
        <Card key={title} className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            <Icon className={`h-4 w-4 ${color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
