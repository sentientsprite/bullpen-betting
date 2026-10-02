import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { StatusChip } from "@/components/status-chip";
import { getProfile, updateDisplayName } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import {
  availableBalance,
  formatDollars,
} from "@/lib/money";
import type { LedgerEntry, Market, Position } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const profile = await getProfile();
  if (!profile) redirect("/sign-in");

  const supabase = await createClient();
  const [{ data: positions }, { data: ledger }] = await Promise.all([
    supabase
      .from("positions")
      .select("*, market:markets(*)")
      .eq("user_id", profile.id),
    supabase
      .from("ledger_entries")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const posList = (positions ?? []) as (Position & { market: Market | null })[];
  const ledgerList = (ledger ?? []) as LedgerEntry[];
  const avail = availableBalance(profile.balance_cents, profile.reserved_cents);

  let unrealizedCost = 0;
  for (const p of posList) {
    if (p.market?.status === "resolved") continue;
    unrealizedCost += p.yes_cost_cents + p.no_cost_cents;
  }

  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} active="portfolio" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl text-brand">Portfolio</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Play money balances, open risk, and settlement history.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Stat label="Available" value={formatDollars(avail)} />
          <Stat
            label="Reserved (open orders)"
            value={formatDollars(profile.reserved_cents)}
          />
          <Stat
            label="Position cost (open)"
            value={formatDollars(unrealizedCost)}
          />
        </div>

        <section className="mt-10 rounded-lg border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg text-brand">Profile</h2>
              <p className="mt-1 text-sm text-ink-muted">{profile.email}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-ink-muted">
                {(profile.wallet_mode ?? "free") === "linked"
                  ? "Linked mode"
                  : "Free mode"}
              </p>
            </div>
            <Link
              href="/settings"
              className="rounded-md border border-line bg-paper px-3 py-1.5 text-sm font-medium text-brand hover:border-brand"
            >
              Wallet & links
            </Link>
          </div>
          <form action={updateDisplayName} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              name="display_name"
              defaultValue={profile.display_name ?? ""}
              placeholder="Display name"
              className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <button
              type="submit"
              className="rounded-md border border-line bg-paper px-4 py-2 text-sm font-medium hover:border-brand"
            >
              Save
            </button>
          </form>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg text-ink">Positions</h2>
          {posList.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No positions yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line border border-line bg-surface">
              {posList.map((p) => (
                <li key={p.market_id}>
                  <Link
                    href={`/markets/${p.market_id}`}
                    className="block px-4 py-3 hover:bg-paper/80"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {p.market && <StatusChip status={p.market.status} />}
                      <span className="font-medium text-ink">
                        {p.market?.question ?? p.market_id}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-4 font-mono text-xs text-ink-muted">
                      <span>
                        Yes {p.yes_qty} ({formatDollars(p.yes_cost_cents)})
                      </span>
                      <span>
                        No {p.no_qty} ({formatDollars(p.no_cost_cents)})
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg text-ink">Ledger</h2>
          <ul className="mt-3 divide-y divide-line border border-line bg-surface">
            {ledgerList.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
              >
                <div>
                  <span className="font-medium capitalize text-ink">{e.kind}</span>
                  {e.note && (
                    <span className="ml-2 text-ink-muted">{e.note}</span>
                  )}
                </div>
                <span
                  className={`font-mono ${e.amount_cents >= 0 ? "text-signal" : "text-ink"}`}
                >
                  {formatDollars(e.amount_cents)}
                </span>
              </li>
            ))}
            {ledgerList.length === 0 && (
              <li className="px-4 py-6 text-sm text-ink-muted">No entries.</li>
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div className="mt-1 font-mono text-xl text-ink">{value}</div>
    </div>
  );
}
