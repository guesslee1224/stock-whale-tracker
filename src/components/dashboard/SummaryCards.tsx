import { TrendingUpIcon, TrendingDownIcon, UsersIcon, BellIcon } from "lucide-react";

interface Props {
  buyCount: number;
  sellCount: number;
  congressCount: number;
  insiderCount: number;
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

export function SummaryCards({ buyCount, sellCount, congressCount, insiderCount, alertsSentToday }: Props) {
  const cards: CardConfig[] = [
    {
      title: "Buy Signals",
      value: buyCount.toLocaleString(),
      description: `30-day inflow · ${insiderCount.toLocaleString()} insider`,
      icon: TrendingUpIcon,
      accent: "#00E87A",
      glow: "rgba(0, 232, 122, 0.12)",
      iconBg: "rgba(0, 232, 122, 0.1)",
    },
    {
      title: "Sell Signals",
      value: sellCount.toLocaleString(),
      description: "30-day outflow",
      icon: TrendingDownIcon,
      accent: "#FF4D6D",
      glow: "rgba(255, 77, 109, 0.12)",
      iconBg: "rgba(255, 77, 109, 0.1)",
    },
    {
      title: "Congress Trades",
      value: congressCount.toLocaleString(),
      description: "30-day disclosures",
      icon: UsersIcon,
      accent: "#FFB800",
      glow: "rgba(255, 184, 0, 0.12)",
      iconBg: "rgba(255, 184, 0, 0.1)",
    },
    {
      title: "Alerts Today",
      value: alertsSentToday.toLocaleString(),
      description: "Push notifications sent",
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
