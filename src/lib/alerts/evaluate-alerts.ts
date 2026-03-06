import type { ActivityRow, AlertSettingsRow } from "@/types/database.types";

// Returns true if an activity event should trigger a push notification
// based on the user's alert settings.
export function shouldAlert(
  activity: Pick<ActivityRow, "value_usd" | "activity_type" | "actor_type">,
  settings: Pick<
    AlertSettingsRow,
    | "min_trade_value_usd"
    | "alert_congress"
    | "alert_insider"
    | "alert_institutional"
  >
): boolean {
  // Filter by actor type preference
  if (activity.actor_type === "congress" && !settings.alert_congress) return false;
  if (activity.actor_type === "insider" && !settings.alert_insider) return false;
  if (activity.actor_type === "institution" && !settings.alert_institutional) return false;

  // Filter by minimum trade value (value_usd stored in cents)
  if (
    activity.value_usd !== null &&
    activity.value_usd < settings.min_trade_value_usd
  ) {
    return false;
  }

  // Only alert on bullish signals (buys/new positions/increases)
  const bullishTypes = ["buy", "new_position", "increase"];
  if (!bullishTypes.includes(activity.activity_type)) return false;

  return true;
}

// Returns true if current time is within quiet hours (no notifications)
export function isQuietHours(
  settings: Pick<AlertSettingsRow, "quiet_hours_start" | "quiet_hours_end">
): boolean {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = settings.quiet_hours_start.split(":").map(Number);
  const [endH, endM] = settings.quiet_hours_end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes > endMinutes) {
    // Overnight quiet hours (e.g., 22:00 – 08:00)
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

// Format a human-readable notification from an activity event
export function formatAlertMessage(activity: ActivityRow): {
  title: string;
  body: string;
} {
  const actorLabel = activity.actor_name ?? "Unknown";
  const typeLabel = formatActivityType(activity.activity_type);
  const valueLabel = activity.value_usd
    ? ` — ${formatCents(activity.value_usd)}`
    : "";

  return {
    title: `🐋 ${activity.ticker} — ${actorLabel}`,
    body: `${typeLabel}${valueLabel} on ${activity.trade_date ?? "unknown date"}`,
  };
}

function formatActivityType(type: ActivityRow["activity_type"]): string {
  const map: Record<ActivityRow["activity_type"], string> = {
    buy: "Bought",
    sell: "Sold",
    increase: "Increased position",
    decrease: "Decreased position",
    new_position: "New position opened",
    closed_position: "Position closed",
  };
  return map[type] ?? type;
}

export function formatCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000_000) return `$${(dollars / 1_000_000_000).toFixed(1)}B`;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`;
  return `$${dollars.toFixed(0)}`;
}
