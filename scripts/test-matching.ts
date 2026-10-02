import assert from "node:assert/strict";
import {
  buildOrderBook,
  findMatches,
  confirmationProgress,
} from "../lib/market/matching";
import type { Order } from "../lib/types";

function order(
  partial: Partial<Order> &
    Pick<Order, "id" | "side" | "price_cents" | "qty">,
): Order {
  return {
    market_id: "m1",
    user_id: "u-maker",
    filled_qty: 0,
    status: "open",
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

const resting = [
  order({ id: "o1", side: "no", price_cents: 60, qty: 5, user_id: "u2" }),
  order({ id: "o2", side: "no", price_cents: 55, qty: 3, user_id: "u3" }),
];

const fills = findMatches(resting, {
  side: "yes",
  price_cents: 40,
  qty: 4,
  user_id: "u1",
});
assert.equal(fills.length, 1);
assert.equal(fills[0].order_id, "o1");
assert.equal(fills[0].qty, 4);
assert.equal(fills[0].yes_price_cents, 40);

const fills2 = findMatches(resting, {
  side: "yes",
  price_cents: 45,
  qty: 2,
  user_id: "u1",
});
assert.equal(fills2[0].yes_price_cents, 40);

const book = buildOrderBook(resting);
assert.equal(book.no_bids[0].price_cents, 60);
assert.equal(book.no_bids[0].qty, 5);

assert.equal(confirmationProgress(2).ready, true);
assert.equal(confirmationProgress(1).ready, false);

console.log("matching tests passed");
