import { Badge } from "@/components/ui/badge";
import type { ActivityRow } from "@/types/database.types";
import { formatCents, formatDate, formatActorType, formatActivityType } from "@/lib/utils/format";
import { TrendingUpIcon, TrendingDownIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  item: ActivityRow;
}

const sourceLabels: Record<ActivityRow["source"], string> = {
  quiver_congress: "Congress",
  quiver_insider: "Insider",
  quiver_institutional: "Institution",
  sec_13f: "13F Filing",
  house_congress: "Congress (House)",
  senate_congress: "Congress (Senate)",
  sec_form4: "Insider (Form 4)",
};

const sourceColors: Record<ActivityRow["source"], string> = {
  quiver_congress: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  quiver_insider: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  quiver_institutional: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  sec_13f: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  house_congress: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  senate_congress: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  sec_form4: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export function ActivityItem({ item }: Props) {
  const isBullish = ["buy", "new_position", "increase"].includes(item.activity_type);
  const isBearish = ["sell", "closed_position", "decrease"].includes(item.activity_type);

  const Icon = isBullish ? TrendingUpIcon : isBearish ? TrendingDownIcon : MinusIcon;
  const valueColor = isBullish ? "text-green-400" : isBearish ? "text-red-400" : "text-muted-foreground";

  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
      {/* Trend icon */}
      <div className={cn("mt-0.5 rounded-full p-1.5", isBullish ? "bg-green-500/10" : isBearish ? "bg-red-500/10" : "bg-muted")}>
        <Icon className={cn("h-3.5 w-3.5", valueColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm font-mono">{item.ticker}</span>
          <Badge
            variant="outline"
            className={cn("text-xs", sourceColors[item.source])}
          >
            {sourceLabels[item.source]}
          </Badge>
          <span className={cn("text-xs font-medium", valueColor)}>
            {formatActivityType(item.activity_type)}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {item.actor_name && (
            <span className="truncate max-w-[200px]">{item.actor_name}</span>
          )}
          {item.actor_name && <span>·</span>}
          <span>{formatDate(item.trade_date ?? item.filed_date)}</span>
          {item.value_usd && (
            <>
              <span>·</span>
              <span className={cn("font-medium", valueColor)}>
                {formatCents(item.value_usd)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
