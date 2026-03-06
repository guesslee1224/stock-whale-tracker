"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ActivityItem } from "./ActivityItem";
import type { ActivityRow } from "@/types/database.types";
import { Badge } from "@/components/ui/badge";

type SortKey = "newest" | "oldest" | "ticker" | "value";
type SourceFilter = "all" | "insider" | "institution" | "congress";

interface Props {
  initialItems: ActivityRow[];
  filter?: {
    actorType?: string;
    ticker?: string;
  };
}

export function ActivityFeed({ initialItems, filter }: Props) {
  const [items, setItems] = useState<ActivityRow[]>(initialItems);
  const [newCount, setNewCount] = useState(0);
  const [sort, setSort] = useState<SortKey>("newest");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel("institutional_activity_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "institutional_activity",
        },
        (payload) => {
          const newItem = payload.new as ActivityRow;

          if (filter?.actorType && newItem.actor_type !== filter.actorType) return;
          if (filter?.ticker && newItem.ticker !== filter.ticker) return;

          setItems((prev) => [newItem, ...prev].slice(0, 500));
          setNewCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  const displayed = useMemo(() => {
    let filtered = items;

    // Source filter
    if (sourceFilter !== "all") {
      filtered = filtered.filter((item) => {
        if (sourceFilter === "insider") return item.source === "sec_form4";
        if (sourceFilter === "institution") return item.source === "sec_13f";
        if (sourceFilter === "congress")
          return item.source === "house_congress" || item.source === "senate_congress";
        return true;
      });
    }

    // Sort
    return [...filtered].sort((a, b) => {
      if (sort === "ticker") {
        return (a.ticker ?? "").localeCompare(b.ticker ?? "");
      }
      if (sort === "value") {
        return (b.value_usd ?? 0) - (a.value_usd ?? 0);
      }
      // newest / oldest — sort by fetched_at then filed_date then trade_date
      const dateA = a.fetched_at ?? a.filed_date ?? a.trade_date ?? "";
      const dateB = b.fetched_at ?? b.filed_date ?? b.trade_date ?? "";
      return sort === "oldest"
        ? dateA.localeCompare(dateB)
        : dateB.localeCompare(dateA);
    });
  }, [items, sort, sourceFilter]);

  const sourceFilterLabels: Record<SourceFilter, string> = {
    all: "All",
    insider: "Insider",
    institution: "Institutional",
    congress: "Congress",
  };

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Source filter pills */}
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "insider", "institution", "congress"] as SourceFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setSourceFilter(f)}
              className={[
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                sourceFilter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
              ].join(" ")}
            >
              {sourceFilterLabels[f]}
            </button>
          ))}
        </div>

        {/* Sort select */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-xs rounded-md border border-border bg-background text-foreground px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="ticker">Ticker A–Z</option>
            <option value="value">Highest value</option>
          </select>
        </div>
      </div>

      {/* New items badge */}
      {newCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="animate-pulse">
            {newCount} new item{newCount > 1 ? "s" : ""}
          </Badge>
          <button
            onClick={() => setNewCount(0)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Items */}
      <div className="space-y-3">
        {displayed.map((item) => (
          <ActivityItem key={item.id} item={item} />
        ))}

        {displayed.length === 0 && (
          <div className="border border-dashed border-border rounded-xl p-8 text-center">
            <p className="text-muted-foreground text-sm">
              {items.length === 0
                ? "No activity yet. The feed will update in real-time as cron jobs fetch new data."
                : "No items match the current filter."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
