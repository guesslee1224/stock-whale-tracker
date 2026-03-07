"use client";

import { useState, useTransition, useMemo } from "react";
import { addToWatchlist, removeFromWatchlist } from "@/actions/watchlist";
import { XIcon, PlusIcon, Loader2Icon, TrendingUpIcon, TrendingDownIcon, RefreshCwIcon, ChevronUpIcon, ChevronDownIcon } from "lucide-react";
import type { WatchlistRow } from "@/types/database.types";

type SortKey = "ticker" | "company" | "signals" | "last_trade";
type SortDir = "asc" | "desc";

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


export function WatchlistManager({ initialTickers, activityStats = {} }: Props) {
  const [tickers, setTickers] = useState(initialTickers);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [syncingTicker, setSyncingTicker] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Default direction: desc for signals + last_trade (higher/newer first), asc for text
      setSortDir(key === "signals" || key === "last_trade" ? "desc" : "asc");
    }
  }

  const sortedTickers = useMemo(() => {
    return [...tickers].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "ticker") {
        cmp = a.ticker.localeCompare(b.ticker);
      } else if (sortKey === "company") {
        cmp = (a.company_name ?? "").localeCompare(b.company_name ?? "");
      } else if (sortKey === "signals") {
        cmp = (activityStats[a.ticker]?.total ?? 0) - (activityStats[b.ticker]?.total ?? 0);
      } else if (sortKey === "last_trade") {
        const da = activityStats[a.ticker]?.last_trade ?? "";
        const db = activityStats[b.ticker]?.last_trade ?? "";
        cmp = da.localeCompare(db);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [tickers, sortKey, sortDir, activityStats]);

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
      } else {
        // Auto-sync the new ticker in the background — no need to wait
        setSyncingTicker(ticker);
        fetch("/api/sync/ticker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker }),
        }).finally(() => setSyncingTicker(null));
      }
    });
  }

  async function handleRemove(ticker: string, id: string) {
    setRemovingId(id);
    setTickers((prev) => prev.filter((t) => t.id !== id));

    startTransition(async () => {
      const result = await removeFromWatchlist(ticker);
      if (result.error) setError(result.error);
      setRemovingId(null);
    });
  }

  return (
    <div className="space-y-5">
      {/* ── Add ticker bar ── */}
      <form onSubmit={handleAdd} className="flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <input
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="Add symbol…"
            maxLength={5}
            className="w-full rounded border border-border bg-muted/30 text-foreground text-sm px-3 py-2.5 font-mono font-bold tracking-widest focus:outline-none focus:ring-1 focus:ring-primary transition-colors duration-150"
            style={{ caretColor: "#00E87A" }}
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

      {/* ── Watchlist table ── */}
      {tickers.length > 0 ? (
        <div className="rounded-lg overflow-hidden" style={{ boxShadow: "inset 0 0 0 1px #1A2D4A" }}>
          {/* Header */}
          <div
            className="grid gap-4 px-4 py-2.5"
            style={{
              gridTemplateColumns: "minmax(120px,1.8fr) minmax(140px,3fr) 160px 130px 28px",
              background: "rgba(6, 13, 26, 0.9)",
              borderBottom: "1px solid #1A2D4A",
            }}
          >
            {(
              [
                { label: "Symbol",     key: "ticker"     as SortKey, align: "flex-start" },
                { label: "Company",    key: "company"    as SortKey, align: "flex-start" },
                { label: "Signals",    key: "signals"    as SortKey, align: "flex-start" },
                { label: "Last Trade", key: "last_trade" as SortKey, align: "flex-end"   },
                { label: "",           key: null,                    align: "flex-end"   },
              ] as const
            ).map(({ label, key, align }) => {
              const active = key === sortKey;
              const Chevron = sortDir === "asc" ? ChevronUpIcon : ChevronDownIcon;
              return (
                <button
                  key={label || "remove"}
                  onClick={() => key && handleSort(key)}
                  disabled={!key}
                  className="text-[10px] font-semibold tracking-widest uppercase transition-colors duration-100 disabled:cursor-default"
                  style={{
                    color: active ? "#C8D8EC" : "#3A5070",
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                    justifyContent: align,
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: key ? "pointer" : "default",
                  }}
                >
                  {label}
                  {key && (
                    <Chevron
                      className="h-2.5 w-2.5 flex-shrink-0"
                      style={{ opacity: active ? 1 : 0.25 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Rows */}
          {sortedTickers.map(({ id, ticker, company_name }, i) => {
            const stats = activityStats[ticker];
            const isTemp = id.startsWith("temp-");
            const isRemoving = removingId === id;

            return (
              <div
                key={id}
                className="group grid gap-4 px-4 py-3 items-center transition-colors duration-150"
                style={{
                  gridTemplateColumns: "minmax(120px,1.8fr) minmax(140px,3fr) 160px 130px 28px",
                  background: i % 2 === 0 ? "rgba(10, 22, 40, 0.65)" : "rgba(6, 13, 26, 0.55)",
                  borderBottom: i < sortedTickers.length - 1 ? "1px solid rgba(26, 45, 74, 0.4)" : "none",
                  opacity: isRemoving ? 0.35 : 1,
                  cursor: "default",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background = "rgba(0, 232, 122, 0.035)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.background =
                    i % 2 === 0 ? "rgba(10, 22, 40, 0.65)" : "rgba(6, 13, 26, 0.55)")
                }
              >
                {/* ── Symbol cell ── */}
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="font-mono font-extrabold text-[15px] tracking-wider"
                    style={{ color: "#00E87A", letterSpacing: "0.08em" }}
                  >
                    {ticker}
                  </span>

                  {isTemp && (
                    <Loader2Icon className="h-3 w-3 animate-spin flex-shrink-0" style={{ color: "#8097B4" }} />
                  )}
                  {!isTemp && syncingTicker === ticker && (
                    <span className="flex items-center gap-1 text-[9px] font-semibold tracking-wider flex-shrink-0" style={{ color: "#8097B4" }}>
                      <RefreshCwIcon className="h-2.5 w-2.5 animate-spin" />
                      Syncing
                    </span>
                  )}
                </div>

                {/* ── Company name ── */}
                <span
                  className="text-xs truncate"
                  style={{ color: company_name ? "#C8D8EC" : "#3A5070" }}
                  title={company_name ?? undefined}
                >
                  {company_name ?? "—"}
                </span>

                {/* ── Signals ── */}
                <div className="flex w-full items-center justify-start gap-1.5">
                  {stats && stats.total > 0 ? (
                    <>
                      {stats.buys > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded tabular-nums"
                          style={{
                            background: "rgba(0, 232, 122, 0.09)",
                            color: "#00E87A",
                            border: "1px solid rgba(0, 232, 122, 0.18)",
                          }}
                        >
                          <TrendingUpIcon className="h-2.5 w-2.5 flex-shrink-0" />
                          {stats.buys.toLocaleString()}
                        </span>
                      )}
                      {stats.sells > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded tabular-nums"
                          style={{
                            background: "rgba(255, 77, 109, 0.09)",
                            color: "#FF4D6D",
                            border: "1px solid rgba(255, 77, 109, 0.18)",
                          }}
                        >
                          <TrendingDownIcon className="h-2.5 w-2.5 flex-shrink-0" />
                          {stats.sells.toLocaleString()}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px]" style={{ color: "#3A5070" }}>—</span>
                  )}
                </div>

                {/* ── Last Trade ── */}
                <span
                  className="text-[11px] font-mono text-right tabular-nums"
                  style={{ color: stats?.last_trade ? "#8097B4" : "#3A5070" }}
                >
                  {stats?.last_trade ? formatDate(stats.last_trade) : "—"}
                </span>

                {/* ── Remove ── */}
                <button
                  onClick={() => handleRemove(ticker, id)}
                  disabled={isRemoving}
                  className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded transition-all duration-150 ml-auto"
                  style={{
                    background: "rgba(255, 77, 109, 0.08)",
                    color: "#FF4D6D",
                    border: "1px solid rgba(255, 77, 109, 0.2)",
                  }}
                  aria-label={`Remove ${ticker}`}
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </div>
            );
          })}
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

      {/* Footer */}
      {tickers.length > 0 && (
        <p className="text-[11px]" style={{ color: "#3A5070" }}>
          {tickers.length} symbol{tickers.length !== 1 ? "s" : ""} monitored ·
          Signals refresh every 20 min during market hours
        </p>
      )}
    </div>
  );
}
