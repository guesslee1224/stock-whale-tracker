import { TrendingUpIcon, UsersIcon, ActivityIcon, BellIcon } from "lucide-react";
import type { ActivityRow } from "@/types/database.types";
import { formatCents } from "@/lib/utils/format";

interface Props {
  activity: ActivityRow[];
  alertsSentToday: number;
}

interface CardConfig {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  glow: string;
  iconBg: string;
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

  const cards: CardConfig[] = [
    {
      title: "Buy Volume",
      value: formatCents(totalValue),
      description: "30-day inflow",
      icon: TrendingUpIcon,
      accent: "#00E87A",
      glow: "rgba(0, 232, 122, 0.12)",
      iconBg: "rgba(0, 232, 122, 0.1)",
    },
    {
      title: "Active Tickers",
      value: uniqueTickers.toString(),
      description: "With whale activity",
      icon: ActivityIcon,
      accent: "#38BDF8",
      glow: "rgba(56, 189, 248, 0.12)",
      iconBg: "rgba(56, 189, 248, 0.1)",
    },
    {
      title: "Congress Trades",
      value: congressCount.toString(),
      description: "Buy trades tracked",
      icon: UsersIcon,
      accent: "#FFB800",
      glow: "rgba(255, 184, 0, 0.12)",
      iconBg: "rgba(255, 184, 0, 0.1)",
    },
    {
      title: "Alerts Today",
      value: alertsSentToday.toString(),
      description: "Push notifications",
      icon: BellIcon,
      accent: "#A78BFA",
      glow: "rgba(167, 139, 250, 0.12)",
      iconBg: "rgba(167, 139, 250, 0.1)",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ title, value, description, icon: Icon, accent, glow, iconBg }) => (
        <div
          key={title}
          className="relative rounded-lg border border-border bg-card p-4 overflow-hidden transition-all duration-200 group"
          style={{ borderTopColor: accent, borderTopWidth: "2px" }}
        >
          {/* Radial hover glow */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none rounded-lg"
            style={{ background: `radial-gradient(ellipse at top, ${glow}, transparent 70%)` }}
          />

          <div className="relative flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted-foreground mb-2">
                {title}
              </p>
              <p
                className="text-2xl font-mono font-bold leading-none tracking-tight"
                style={{ color: accent }}
              >
                {value}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {description}
              </p>
            </div>
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 ml-2"
              style={{ background: iconBg }}
            >
              <Icon className="h-4 w-4" style={{ color: accent }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
