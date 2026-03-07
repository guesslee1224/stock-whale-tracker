"use client";

import { useState, useTransition } from "react";
import { addToWatchlist, removeFromWatchlist } from "@/actions/watchlist";
import { XIcon, PlusIcon, Loader2Icon, SearchIcon, TrendingUpIcon, TrendingDownIcon } from "lucide-react";
import type { WatchlistRow } from "@/types/database.types";

interface ActivityStat {
  total: number;
  buys: number;
  sells: number;
  last_trade: string | null;
}

interface Props {
  initialTickers: WatchlistRow[];
  activityStats?: Record<string, ActivityStat>;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatAddedDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

export function WatchlistManager({ initialTickers, activityStats = {} }: Props) {
  const [tickers, setTickers] = useState(initialTickers);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const ticker = inputValue.trim().toUpperCase();
    if (!ticker) return;

    const tempRow: WatchlistRow = {
      id: `temp-${ticker}`,
      ticker,
      company_name: null,
      added_at: new Date().toISOString(),
      is_active: true,
    };
    setTickers((prev) => [...prev, tempRow]);
    setInputValue("");

    startTransition(async () => {
      const result = await addToWatchlist(ticker);
      if (result.error) {
        setTickers((prev) => prev.filter((t) => t.id !== tempRow.id));
        setError(result.error);
      }
    });
  }

  async function handleRemove(ticker: string, id: string) {
    setRemovingId(id);
    setTickers((prev) => prev.filter((t) => t.id !== id));

    startTransition(async () => {
      const result = await removeFromWatchlist(ticker);
      if (result.error) {
        setError(result.error);
      }
      setRemovingId(null);
    });
  }

  return (
    <div className="space-y-5">
      {/* Add ticker bar */}
      <form
        onSubmit={handleAdd}
        className="flex gap-2 max-w-sm"
      >
        <div className="relative flex-1">
          <SearchIcon
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
            style={{ color: "#8097B4" }}
          />
          <input
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="Add symbol…"
            maxLength={5}
            className="w-full rounded border border-border bg-muted/30 text-foreground text-sm pl-8 pr-3 py-2.5 font-mono uppercase tracking-widest placeholder:text-muted-foreground/40 placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-1 focus:ring-primary transition-colors duration-150"
          />
        </div>
        <button
          type="submit"
          disabled={isPending || !inputValue.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded text-[11px] font-bold tracking-wide uppercase transition-all duration-150"
          style={
            isPending || !inputValue.trim()
              ? {
                  background: "rgba(128, 151, 180, 0.08)",
                  color: "#8097B4",
                  boxShadow: "inset 0 0 0 1px #1A2D4A",
                  cursor: isPending ? "wait" : "not-allowed",
                }
              : {
                  background: "#00E87A",
                  color: "#060D1A",
                  boxShadow: "0 0 12px rgba(0, 232, 122, 0.15)",
                }
          }
        >
          {isPending ? (
            <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PlusIcon className="h-3.5 w-3.5" />
          )}
          Add
        </button>
      </form>

      {error && (
        <p
          className="text-[11px] px-3 py-2 rounded"
          style={{
            background: "rgba(255, 77, 109, 0.08)",
            color: "#FF4D6D",
            boxShadow: "inset 0 0 0 1px rgba(255, 77, 109, 0.2)",
          }}
        >
          {error}
        </p>
      )}

      {/* Watchlist table */}
      {tickers.length > 0 ? (
        <div
          className="rounded-lg overflow-hidden"
          style={{ boxShadow: "inset 0 0 0 1px #1A2D4A" }}
        >
          {/* Table header */}
          <div
            className="grid gap-4 px-4 py-2.5"
            style={{
              gridTemplateColumns: "2fr 3fr 1fr 1fr 1fr auto",
              background: "rgba(6, 13, 26, 0.8)",
              borderBottom: "1px solid #1A2D4A",
            }}
          >
            <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Symbol</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Company</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground text-right">Signals</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground text-right">Last Trade</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground text-right">Added</span>
            <span className="w-6" />
          </div>

          {/* Rows */}
          <div>
            {tickers.map(({ id, ticker, company_name, added_at }, i) => {
              const stats = activityStats[ticker];
              const isTemp = id.startsWith("temp-");
              const isRemoving = removingId === id;

              return (
                <div
                  key={id}
                  className="group grid gap-4 px-4 py-3 items-center transition-colors duration-150"
                  style={{
                    gridTemplateColumns: "2fr 3fr 1fr 1fr 1fr auto",
                    background: i % 2 === 0 ? "rgba(10, 22, 40, 0.6)" : "rgba(6, 13, 26, 0.5)",
                    borderBottom: i < tickers.length - 1 ? "1px solid rgba(26, 45, 74, 0.5)" : "none",
                    opacity: isRemoving ? 0.4 : 1,
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.background = "rgba(0, 232, 122, 0.04)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.background =
                      i % 2 === 0 ? "rgba(10, 22, 40, 0.6)" : "rgba(6, 13, 26, 0.5)")
                  }
                >
                  {/* Symbol */}
                  <div className="flex items-center gap-2.5">
                    <span
                      className="font-mono font-bold text-sm tracking-widest"
                      style={{ color: "#00E87A" }}
                    >
                      {ticker}
                    </span>
                    {isTemp && (
                      <Loader2Icon className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                    {!isTemp && (
                      <span
                        className="flex items-center gap-1 text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded"
                        style={{
                          background: "rgba(0, 232, 122, 0.06)",
                          color: "rgba(0, 232, 122, 0.6)",
                          boxShadow: "inset 0 0 0 1px rgba(0, 232, 122, 0.12)",
                        }}
                      >
                        <span
                          className="w-1 h-1 rounded-full animate-pulse"
                          style={{ background: "#00E87A", opacity: 0.7 }}
                        />
                        Live
                      </span>
                    )}
                  </div>

                  {/* Company */}
                  <span className="text-xs text-muted-foreground truncate">
                    {company_name ?? (
                      <span style={{ color: "#3A5070" }}>—</span>
                    )}
                  </span>

                  {/* Signals */}
                  <div className="flex items-center justify-end gap-2">
                    {stats && stats.total > 0 ? (
                      <>
                        {stats.buys > 0 && (
                          <span
                            className="flex items-center gap-0.5 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
                            style={{
                              background: "rgba(0, 232, 122, 0.08)",
                              color: "#00E87A",
                              boxShadow: "inset 0 0 0 1px rgba(0, 232, 122, 0.15)",
                            }}
                          >
                            <TrendingUpIcon className="h-2.5 w-2.5" />
                            {stats.buys}
                          </span>
                        )}
                        {stats.sells > 0 && (
                          <span
                            className="flex items-center gap-0.5 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
                            style={{
                              background: "rgba(255, 77, 109, 0.08)",
                              color: "#FF4D6D",
                              boxShadow: "inset 0 0 0 1px rgba(255, 77, 109, 0.15)",
                            }}
                          >
                            <TrendingDownIcon className="h-2.5 w-2.5" />
                            {stats.sells}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px]" style={{ color: "#3A5070" }}>—</span>
                    )}
                  </div>

                  {/* Last Trade */}
                  <span className="text-[11px] font-mono text-right" style={{ color: "#8097B4" }}>
                    {stats?.last_trade ? formatDate(stats.last_trade) : <span style={{ color: "#3A5070" }}>—</span>}
                  </span>

                  {/* Added */}
                  <span className="text-[11px] font-mono text-right" style={{ color: "#8097B4" }}>
                    {formatAddedDate(added_at)}
                  </span>

                  {/* Remove */}
                  <button
                    onClick={() => handleRemove(ticker, id)}
                    disabled={isRemoving}
                    className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded transition-all duration-150"
                    style={{
                      background: "rgba(255, 77, 109, 0.08)",
                      color: "#FF4D6D",
                      boxShadow: "inset 0 0 0 1px rgba(255, 77, 109, 0.2)",
                    }}
                    aria-label={`Remove ${ticker}`}
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          className="rounded-lg border border-dashed border-border p-12 text-center"
          style={{ background: "rgba(10, 22, 40, 0.5)" }}
        >
          <p className="text-sm text-muted-foreground">
            No symbols tracked. Add a ticker above to start monitoring whale activity.
          </p>
        </div>
      )}

      {/* Footer stats */}
      {tickers.length > 0 && (
        <p className="text-[11px]" style={{ color: "#3A5070" }}>
          {tickers.length} symbol{tickers.length !== 1 ? "s" : ""} monitored ·
          Signals refresh every 20 min during market hours
        </p>
      )}
    </div>
  );
}
