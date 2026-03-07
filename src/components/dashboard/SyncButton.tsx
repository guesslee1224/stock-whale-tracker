"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";

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
      router.refresh();
      setTimeout(() => setState("idle"), 4000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  const label = {
    idle: "Sync",
    syncing: "Syncing…",
    done: newCount != null ? `+${newCount} new` : "Done",
    error: "Failed",
  }[state];

  const stateStyles: Record<SyncState, React.CSSProperties> = {
    idle: {
      background: "rgba(0, 232, 122, 0.1)",
      color: "#00E87A",
      boxShadow: "inset 0 0 0 1px rgba(0, 232, 122, 0.3)",
    },
    syncing: {
      background: "rgba(128, 151, 180, 0.08)",
      color: "#8097B4",
      boxShadow: "inset 0 0 0 1px #1A2D4A",
      cursor: "wait",
    },
    done: {
      background: "rgba(0, 232, 122, 0.15)",
      color: "#00E87A",
      boxShadow: "inset 0 0 0 1px rgba(0, 232, 122, 0.4)",
    },
    error: {
      background: "rgba(255, 77, 109, 0.1)",
      color: "#FF4D6D",
      boxShadow: "inset 0 0 0 1px rgba(255, 77, 109, 0.3)",
    },
  };

  return (
    <button
      onClick={handleSync}
      disabled={state === "syncing"}
      className="flex items-center gap-2 px-3.5 py-2 rounded text-[11px] font-medium tracking-wide uppercase transition-all duration-150"
      style={stateStyles[state]}
    >
      <RefreshCwIcon className={`h-3.5 w-3.5 ${state === "syncing" ? "animate-spin" : ""}`} />
      {label}
    </button>
  );
}
