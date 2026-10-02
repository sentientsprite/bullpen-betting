import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { StatusChip } from "@/components/status-chip";
import { getProfile } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { formatCentsPrice, formatProbability } from "@/lib/money";
import { buildOrderBook, impliedYesPrice } from "@/lib/market/matching";
import type { Market, Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await getProfile();
  if (!profile) redirect("/sign-in");

  const supabase = await createClient();
  const { data: markets } = await supabase
    .from("markets")
    .select("*")
    .order("created_at", { ascending: false });

  const list = (markets ?? []) as Market[];
  const live = list.filter((m) => m.status === "live");
  const proposed = list.filter((m) => m.status === "proposed");
  const resolved = list.filter((m) => m.status === "resolved").slice(0, 8);

  const marketIds = list.map((m) => m.id);
  const { data: orders } =
    marketIds.length > 0
      ? await supabase
          .from("orders")
          .select("*")
          .in("market_id", marketIds)
          .in("status", ["open", "partial", "filled"])
      : { data: [] as Order[] };

  const allOrders = (orders ?? []) as Order[];
  const confMap = new Map<string, number>();
  const bookPrice = new Map<string, number | null>();

  for (const m of list) {
    const others = new Set(
      allOrders
        .filter((o) => o.market_id === m.id && o.user_id !== m.created_by)
        .map((o) => o.user_id),
    );
    confMap.set(m.id, others.size);
    const open = allOrders.filter(
      (o) =>
        o.market_id === m.id &&
        (o.status === "open" || o.status === "partial"),
    );
    bookPrice.set(m.id, impliedYesPrice(buildOrderBook(open)));
  }

  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} active="dashboard" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-brand">Markets</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Live books and proposals waiting for confirmations.
            </p>
          </div>
          <Link
            href="/markets/new"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-paper hover:bg-brand-glow"
          >
            Suggest a market
          </Link>
        </div>

        <Section title="Live">
          {live.length === 0 ? (
            <Empty>No live markets yet. Confirm a proposal to open the book.</Empty>
          ) : (
            <ul className="divide-y divide-line border border-line bg-surface">
              {live.map((m) => (
                <MarketRow
                  key={m.id}
                  market={m}
                  confirmations={confMap.get(m.id) ?? 0}
                  yesPrice={bookPrice.get(m.id) ?? null}
                />
              ))}
            </ul>
          )}
        </Section>

        <Section title="Proposed">
          {proposed.length === 0 ? (
            <Empty>No proposals. Suggest the next team question.</Empty>
          ) : (
            <ul className="divide-y divide-line border border-line bg-surface">
              {proposed.map((m) => (
                <MarketRow
                  key={m.id}
                  market={m}
                  confirmations={confMap.get(m.id) ?? 0}
                  yesPrice={bookPrice.get(m.id) ?? null}
                />
              ))}
            </ul>
          )}
        </Section>

        {resolved.length > 0 && (
          <Section title="Recently resolved">
            <ul className="divide-y divide-line border border-line bg-surface">
              {resolved.map((m) => (
                <MarketRow
                  key={m.id}
                  market={m}
                  confirmations={confMap.get(m.id) ?? 0}
                  yesPrice={null}
                />
              ))}
            </ul>
          </Section>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-display text-lg text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-ink-muted">
      {children}
    </div>
  );
}

function MarketRow({
  market,
  confirmations,
  yesPrice,
}: {
  market: Market;
  confirmations: number;
  yesPrice: number | null;
}) {
  return (
    <li>
      <Link
        href={`/markets/${market.id}`}
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-paper/80"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              status={market.status}
              confirmations={confirmations}
            />
            {market.status === "resolved" && market.resolved_outcome && (
              <span className="font-mono text-xs uppercase text-ink-muted">
                {market.resolved_outcome} won
              </span>
            )}
          </div>
          <p className="mt-1 truncate font-medium text-ink">{market.question}</p>
        </div>
        <div className="text-right font-mono text-sm">
          {yesPrice != null ? (
            <>
              <div className="text-signal">{formatCentsPrice(yesPrice)}</div>
              <div className="text-[10px] text-ink-muted">
                Yes · {formatProbability(yesPrice)}
              </div>
            </>
          ) : (
            <span className="text-ink-muted">—</span>
          )}
        </div>
      </Link>
    </li>
  );
}
