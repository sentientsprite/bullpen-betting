import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { OrderBookPanel } from "@/components/order-book";
import { OrderForm } from "@/components/order-form";
import { ResolvePanel } from "@/components/resolve-panel";
import { StatusChip } from "@/components/status-chip";
import { getProfile } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { buildOrderBook } from "@/lib/market/matching";
import { formatCentsPrice, formatDollars } from "@/lib/money";
import type { Market, Order, Position, Trade } from "@/lib/types";
import { cancelOrder } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile) redirect("/sign-in");

  const supabase = await createClient();
  const { data: market } = await supabase
    .from("markets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!market) notFound();
  const m = market as Market;

  const [{ data: orders }, { data: trades }, { data: position }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("market_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("trades")
        .select("*")
        .eq("market_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("positions")
        .select("*")
        .eq("market_id", id)
        .eq("user_id", profile.id)
        .maybeSingle(),
    ]);

  const allOrders = (orders ?? []) as Order[];
  const openOrders = allOrders.filter(
    (o) => o.status === "open" || o.status === "partial",
  );
  const book = buildOrderBook(openOrders);
  const tradeList = (trades ?? []) as Trade[];
  const lastTrade = tradeList[0]?.price_cents ?? null;
  const pos = position as Position | null;

  const confirmations = new Set(
    allOrders
      .filter((o) => o.user_id !== m.created_by)
      .map((o) => o.user_id),
  ).size;

  const myOpen = openOrders.filter((o) => o.user_id === profile.id);
  const tradingOpen = m.status === "proposed" || m.status === "live";

  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} active="dashboard" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/dashboard"
          className="text-xs text-ink-muted hover:text-ink hover:underline"
        >
          ← Markets
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip
                status={m.status}
                confirmations={confirmations}
              />
              {m.status === "resolved" && m.resolved_outcome && (
                <span className="rounded-md bg-paper-2 px-2 py-0.5 font-mono text-xs uppercase text-ink">
                  {m.resolved_outcome} won
                </span>
              )}
            </div>
            <h1 className="mt-3 font-display text-3xl leading-tight text-brand">
              {m.question}
            </h1>
            {m.description && (
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                {m.description}
              </p>
            )}
            {m.status === "proposed" && (
              <p className="mt-3 text-sm text-amber">
                Needs {Math.max(0, 2 - confirmations)} more teammate
                {2 - confirmations === 1 ? "" : "s"} to confirm with a bet
                before this goes live.
              </p>
            )}
            {m.resolution_note && (
              <p className="mt-3 text-sm text-ink-muted">
                Resolution note: {m.resolution_note}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <OrderBookPanel book={book} lastTrade={lastTrade} />

            <div className="rounded-lg border border-line bg-surface p-4">
              <h2 className="font-display text-lg text-brand">Recent trades</h2>
              {tradeList.length === 0 ? (
                <p className="mt-3 text-sm text-ink-muted">No fills yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {tradeList.map((t) => (
                    <li
                      key={t.id}
                      className="flex justify-between py-2 font-mono text-sm"
                    >
                      <span>{formatCentsPrice(t.price_cents)} Yes</span>
                      <span className="text-ink-muted">{t.qty} ctr</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <OrderForm marketId={m.id} disabled={!tradingOpen} />

            <div className="rounded-lg border border-line bg-surface p-4">
              <h2 className="font-display text-lg text-brand">Your position</h2>
              {pos && (pos.yes_qty > 0 || pos.no_qty > 0) ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Yes</dt>
                    <dd className="font-mono">
                      {pos.yes_qty} · cost {formatDollars(pos.yes_cost_cents)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">No</dt>
                    <dd className="font-mono">
                      {pos.no_qty} · cost {formatDollars(pos.no_cost_cents)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-ink-muted">No position yet.</p>
              )}
            </div>

            {myOpen.length > 0 && (
              <div className="rounded-lg border border-line bg-surface p-4">
                <h2 className="font-display text-lg text-brand">Your open orders</h2>
                <ul className="mt-3 space-y-2">
                  {myOpen.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="font-mono">
                        Buy {o.side} @ {o.price_cents}¢ ×{" "}
                        {o.qty - o.filled_qty}
                      </span>
                      <form action={cancelOrder}>
                        <input type="hidden" name="order_id" value={o.id} />
                        <input type="hidden" name="market_id" value={m.id} />
                        <button
                          type="submit"
                          className="text-xs text-danger underline-offset-2 hover:underline"
                        >
                          Cancel
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profile.role === "admin" && tradingOpen && (
              <ResolvePanel marketId={m.id} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
