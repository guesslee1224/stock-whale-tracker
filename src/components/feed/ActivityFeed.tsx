"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ActivityItem } from "./ActivityItem";
import type { ActivityRow } from "@/types/database.types";

type SortKey = "newest" | "oldest" | "ticker" | "value";
type SourceFilter = "all" | "insider" | "institution" | "congress";

function getUniqueTickers(items: ActivityRow[]): string[] {
  return Array.from(new Set(items.map((i) => i.ticker).filter(Boolean))).sort();
}

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
  const [tickerFilter, setTickerFilter] = useState<string>("all");

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

          setItems((prev) => [newItem, ...prev].slice(0, 2000));
          setNewCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  const displayed = useMemo(() => {
    // Drop items with no identifiable name — no point showing a nameless row
    let filtered = items.filter((item) => {
      const raw =
        item.raw_payload && typeof item.raw_payload === "object" && !Array.isArray(item.raw_payload)
          ? (item.raw_payload as Record<string, unknown>)
          : {};
      return !!(
        item.actor_name ||
        (raw.owner_name as string | null) ||
        (raw.entity_name as string | null)
      );
    });

    if (tickerFilter !== "all") {
      filtered = filtered.filter((item) => item.ticker === tickerFilter);
    }

    if (sourceFilter !== "all") {
      filtered = filtered.filter((item) => {
        if (sourceFilter === "insider") return item.source === "sec_form4";
        if (sourceFilter === "institution") return item.source === "sec_13f" || item.source === "quiver_institutional";
        if (sourceFilter === "congress")
          return item.source === "house_congress" || item.source === "senate_congress";
        return true;
      });
    }

    return [...filtered].sort((a, b) => {
      if (sort === "ticker") return (a.ticker ?? "").localeCompare(b.ticker ?? "");
      if (sort === "value") return (b.value_usd ?? 0) - (a.value_usd ?? 0);
      const dateA = a.trade_date ?? a.filed_date ?? a.fetched_at ?? "";
      const dateB = b.trade_date ?? b.filed_date ?? b.fetched_at ?? "";
      return sort === "oldest" ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    });
  }, [items, sort, sourceFilter, tickerFilter]);

  const filterLabels: Record<SourceFilter, string> = {
    all: "All",
    insider: "Insider",
    institution: "Institution",
    congress: "Congress",
  };

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Source filter pills */}
        <div className="flex gap-1 flex-wrap">
          {(["all", "insider", "institution", "congress"] as SourceFilter[]).map((f) => {
            const active = sourceFilter === f;
            return (
              <button
                key={f}
                onClick={() => setSourceFilter(f)}
                className="px-3 py-1.5 rounded text-[11px] font-medium tracking-wide uppercase transition-all duration-150"
                style={
                  active
                    ? {
                        background: "rgba(0, 232, 122, 0.1)",
                        color: "#00E87A",
                        boxShadow: "inset 0 0 0 1px rgba(0, 232, 122, 0.3)",
                      }
                    : {
                        background: "transparent",
                        color: "#8097B4",
                        boxShadow: "inset 0 0 0 1px #1A2D4A",
                      }
                }
              >
                {filterLabels[f]}
              </button>
            );
          })}
        </div>

        {/* Ticker filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-widest uppercase text-muted-foreground">Ticker</span>
          <select
            value={tickerFilter}
            onChange={(e) => setTickerFilter(e.target.value)}
            className="text-[11px] rounded border border-border bg-card text-foreground px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          >
            <option value="all">All</option>
            {getUniqueTickers(items).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Sort select */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] tracking-widest uppercase text-muted-foreground">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-[11px] rounded border border-border bg-card text-foreground px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
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
          <span
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded"
            style={{
              background: "rgba(0, 232, 122, 0.08)",
              color: "#00E87A",
              boxShadow: "inset 0 0 0 1px rgba(0, 232, 122, 0.2)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#00E87A" }} />
            {newCount} new
          </span>
          <button
            onClick={() => setNewCount(0)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Items */}
      <div className="space-y-2">
        {displayed.map((item) => (
          <ActivityItem key={item.id} item={item} />
        ))}

        {displayed.length === 0 && (
          <div
            className="rounded-lg border border-dashed border-border p-10 text-center"
            style={{ background: "rgba(10, 22, 40, 0.5)" }}
          >
            <p className="text-sm text-muted-foreground">
              {items.length === 0
                ? "No activity yet. Feed updates in real-time as cron jobs run."
                : "No items match the current filter."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
