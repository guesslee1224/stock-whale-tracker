"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ActivityItem } from "./ActivityItem";
import type { ActivityRow } from "@/types/database.types";
import { Badge } from "@/components/ui/badge";

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

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return; // No Supabase configured — skip realtime

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

          // Apply client-side filter if set
          if (filter?.actorType && newItem.actor_type !== filter.actorType) return;
          if (filter?.ticker && newItem.ticker !== filter.ticker) return;

          setItems((prev) => [newItem, ...prev].slice(0, 200));
          setNewCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  return (
    <div className="space-y-3">
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

      {items.map((item) => (
        <ActivityItem key={item.id} item={item} />
      ))}

      {items.length === 0 && (
        <div className="border border-dashed border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No activity yet. The feed will update in real-time as cron jobs fetch new data.
          </p>
        </div>
      )}
    </div>
  );
}
