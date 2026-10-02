import { formatCentsPrice } from "@/lib/money";
import type { OrderBook } from "@/lib/types";

export function OrderBookPanel({
  book,
  lastTrade,
}: {
  book: OrderBook;
  lastTrade?: number | null;
}) {
  const maxQty = Math.max(
    1,
    ...book.yes_bids.map((l) => l.qty),
    ...book.no_bids.map((l) => l.qty),
  );

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg text-brand">Order book</h2>
        {lastTrade != null && (
          <span className="font-mono text-sm text-ink-muted">
            Last {formatCentsPrice(lastTrade)}
          </span>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <BookColumn
          title="Yes bids"
          accent="signal"
          levels={book.yes_bids}
          maxQty={maxQty}
        />
        <BookColumn
          title="No bids"
          accent="danger"
          levels={book.no_bids}
          maxQty={maxQty}
        />
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Yes @ P matches No @ (100−P). Buy both sides to take a position; close by
        buying the opposite.
      </p>
    </div>
  );
}

function BookColumn({
  title,
  accent,
  levels,
  maxQty,
}: {
  title: string;
  accent: "signal" | "danger";
  levels: { price_cents: number; qty: number }[];
  maxQty: number;
}) {
  const bar =
    accent === "signal" ? "bg-signal/20" : "bg-danger/20";
  const text = accent === "signal" ? "text-signal" : "text-danger";

  return (
    <div>
      <div className={`mb-2 text-xs font-medium uppercase tracking-wider ${text}`}>
        {title}
      </div>
      <div className="space-y-1">
        {levels.length === 0 && (
          <div className="py-6 text-center text-xs text-ink-muted">No bids</div>
        )}
        {levels.slice(0, 8).map((level) => (
          <div
            key={level.price_cents}
            className="relative flex items-center justify-between overflow-hidden rounded px-2 py-1 font-mono text-sm"
          >
            <div
              className={`absolute inset-y-0 left-0 ${bar}`}
              style={{ width: `${(level.qty / maxQty) * 100}%` }}
            />
            <span className="relative">{formatCentsPrice(level.price_cents)}</span>
            <span className="relative text-ink-muted">{level.qty}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
