"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SyncState = "idle" | "syncing" | "done" | "error";

export function SyncButton() {
  const router = useRouter();
  const [state, setState] = useState<SyncState>("idle");
  const [newCount, setNewCount] = useState<number | null>(null);

  async function handleSync() {
    setState("syncing");
    setNewCount(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setNewCount(data.totalNew ?? 0);
      setState("done");
      // Refresh server component data so dashboard shows new records
      router.refresh();
      // Reset button label after 4 seconds
      setTimeout(() => setState("idle"), 4000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const label = {
    idle: "Sync Now",
    syncing: "Syncing…",
    done: newCount != null ? `Done · ${newCount} new` : "Done",
    error: "Sync failed",
  }[state];

  const colors = {
    idle: "bg-primary text-primary-foreground hover:bg-primary/90",
    syncing: "bg-muted text-muted-foreground cursor-wait",
    done: "bg-green-600 text-white",
    error: "bg-destructive text-destructive-foreground",
  }[state];

  return (
    <button
      onClick={handleSync}
      disabled={state === "syncing"}
      className={[
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
        colors,
      ].join(" ")}
    >
      {state === "syncing" && (
        <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {label}
    </button>
  );
}
