"use client";

import { useState, useTransition } from "react";
import { addToWatchlist, removeFromWatchlist } from "@/actions/watchlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { XIcon, PlusIcon, Loader2Icon } from "lucide-react";
import type { WatchlistRow } from "@/types/database.types";

interface Props {
  initialTickers: WatchlistRow[];
}

export function WatchlistManager({ initialTickers }: Props) {
  const [tickers, setTickers] = useState(initialTickers);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const ticker = inputValue.trim().toUpperCase();
    if (!ticker) return;

    // Optimistic UI update
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
    // Optimistic UI update
    setTickers((prev) => prev.filter((t) => t.id !== id));

    startTransition(async () => {
      const result = await removeFromWatchlist(ticker);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Add ticker form */}
      <form onSubmit={handleAdd} className="flex gap-2 max-w-sm">
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value.toUpperCase());
            setError(null);
          }}
          placeholder="Enter ticker (e.g. AAPL)"
          maxLength={5}
          className="font-mono uppercase"
        />
        <Button type="submit" disabled={isPending || !inputValue.trim()}>
          {isPending ? (
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : (
            <PlusIcon className="h-4 w-4" />
          )}
          Add
        </Button>
      </form>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Ticker list */}
      {tickers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tickers.map(({ id, ticker }) => (
            <Badge
              key={id}
              variant="secondary"
              className="text-sm font-mono px-3 py-1.5 flex items-center gap-2"
            >
              {ticker}
              <button
                onClick={() => handleRemove(ticker, id)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={`Remove ${ticker}`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No tickers added yet. Start tracking stocks by adding their ticker symbols above.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {tickers.length} ticker{tickers.length !== 1 ? "s" : ""} tracked.
        Cron jobs fetch data for all active tickers every 20 minutes during market hours.
      </p>
    </div>
  );
}
