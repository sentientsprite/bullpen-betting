import type { Order, OrderBook, OrderBookLevel, OutcomeSide } from "@/lib/types";
import { complementaryPrice } from "@/lib/money";

/** Remaining unfilled quantity on an order. */
export function remainingQty(order: Pick<Order, "qty" | "filled_qty">): number {
  return Math.max(0, order.qty - order.filled_qty);
}

/**
 * Aggregate open buy bids into a depth book.
 * Yes bids sorted high→low (best bid first).
 * No bids sorted high→low.
 */
export function buildOrderBook(orders: Order[]): OrderBook {
  const yesMap = new Map<number, number>();
  const noMap = new Map<number, number>();

  for (const order of orders) {
    if (order.status !== "open" && order.status !== "partial") continue;
    const rem = remainingQty(order);
    if (rem <= 0) continue;
    const map = order.side === "yes" ? yesMap : noMap;
    map.set(order.price_cents, (map.get(order.price_cents) ?? 0) + rem);
  }

  const toLevels = (map: Map<number, number>): OrderBookLevel[] =>
    [...map.entries()]
      .map(([price_cents, qty]) => ({ price_cents, qty }))
      .sort((a, b) => b.price_cents - a.price_cents);

  return {
    yes_bids: toLevels(yesMap),
    no_bids: toLevels(noMap),
  };
}

/**
 * Implied Yes mid from best complementary books.
 * Best Yes bid vs complementary of best No bid.
 */
export function impliedYesPrice(book: OrderBook): number | null {
  const bestYes = book.yes_bids[0]?.price_cents;
  const bestNo = book.no_bids[0]?.price_cents;
  if (bestYes == null && bestNo == null) return null;
  if (bestYes == null) return complementaryPrice(bestNo!);
  if (bestNo == null) return bestYes;
  return Math.round((bestYes + complementaryPrice(bestNo)) / 2);
}

/**
 * Pure matching preview: given a new buy order, which resting opposite
 * orders would fill (Kalshi complementary: Yes@P matches No@(100-P) or better).
 *
 * A Yes buy at P matches No buys where no_price + P >= 100
 * (i.e. no_price >= 100 - P). When matched, trade yes_price = P
 * if taker is Yes; if taker is No at N, trade yes_price = 100 - N.
 */
export function findMatches(
  restingOrders: Order[],
  taker: {
    side: OutcomeSide;
    price_cents: number;
    qty: number;
    user_id: string;
  },
): { order_id: string; qty: number; yes_price_cents: number }[] {
  const opposite: OutcomeSide = taker.side === "yes" ? "no" : "yes";
  const candidates = restingOrders
    .filter(
      (o) =>
        o.side === opposite &&
        o.user_id !== taker.user_id &&
        (o.status === "open" || o.status === "partial") &&
        remainingQty(o) > 0,
    )
    .filter((o) => {
      if (taker.side === "yes") {
        // Yes@P matches No where no_price >= 100 - P
        return o.price_cents + taker.price_cents >= 100;
      }
      // No@N matches Yes where yes_price >= 100 - N
      return o.price_cents + taker.price_cents >= 100;
    })
    .sort((a, b) => {
      // Best opposite first: for matching Yes taker, highest No price first
      // (more aggressive). For No taker, highest Yes price first.
      if (b.price_cents !== a.price_cents) return b.price_cents - a.price_cents;
      return a.created_at.localeCompare(b.created_at);
    });

  let remaining = taker.qty;
  const fills: { order_id: string; qty: number; yes_price_cents: number }[] =
    [];

  for (const maker of candidates) {
    if (remaining <= 0) break;
    const fillQty = Math.min(remaining, remainingQty(maker));
    // Maker price priority: resting order sets the trade price
    const yesPrice =
      taker.side === "yes"
        ? complementaryPrice(maker.price_cents)
        : maker.price_cents;
    fills.push({
      order_id: maker.id,
      qty: fillQty,
      yes_price_cents: yesPrice,
    });
    remaining -= fillQty;
  }

  return fills;
}

export function confirmationProgress(
  distinctOtherBettors: number,
  required = 2,
): { count: number; required: number; ready: boolean } {
  return {
    count: distinctOtherBettors,
    required,
    ready: distinctOtherBettors >= required,
  };
}
