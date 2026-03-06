// Shared formatting utilities

// Format cents (bigint) to a human-readable dollar string
export function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  const dollars = cents / 100;
  if (dollars >= 1_000_000_000) return `$${(dollars / 1_000_000_000).toFixed(1)}B`;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(0)}K`;
  return `$${dollars.toLocaleString()}`;
}

// Format a date string to a friendly relative or absolute label
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Format actor type label
export function formatActorType(actorType: string | null): string {
  switch (actorType) {
    case "congress": return "Congress";
    case "insider": return "Insider";
    case "institution": return "Institution";
    default: return actorType ?? "Unknown";
  }
}

// Format activity type as a short action label
export function formatActivityType(type: string): string {
  const map: Record<string, string> = {
    buy: "Bought",
    sell: "Sold",
    increase: "Increased",
    decrease: "Decreased",
    new_position: "New Position",
    closed_position: "Closed Position",
  };
  return map[type] ?? type;
}
