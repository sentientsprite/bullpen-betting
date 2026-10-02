import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SuggestMarketForm } from "@/components/suggest-market-form";
import { WalletGateBanner } from "@/components/wallet-gate-banner";
import { getPaymentConnections, getProfile } from "@/lib/actions";
import { canTrade } from "@/lib/wallet";

export default async function NewMarketPage() {
  const profile = await getProfile();
  if (!profile) redirect("/sign-in");
  const connections = await getPaymentConnections();
  const trade = canTrade(profile, connections);

  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} active="new" />
      <main className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl text-brand">Suggest a market</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Pose a Yes/No question and place the opening bet. The pool goes live
          after two other teammates confirm with their own bets.
        </p>
        {!trade.ok && (
          <div className="mt-6">
            <WalletGateBanner reason={trade.reason} />
          </div>
        )}
        <div className="mt-8 rounded-lg border border-line bg-surface p-5">
          {trade.ok ? (
            <SuggestMarketForm />
          ) : (
            <p className="text-sm text-ink-muted">
              Switch to Free mode or connect an account to suggest a market.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
