import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { WalletSettings } from "@/components/wallet-settings";
import { getPaymentConnections, getProfile } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/sign-in");
  const connections = await getPaymentConnections();

  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} active="settings" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl text-brand">Wallet & links</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Choose Free mode, or link Cash App / Robinhood for Linked mode.
          Settlements stay on Floor&apos;s play-money ledger either way.
        </p>
        <div className="mt-8">
          <WalletSettings profile={profile} connections={connections} />
        </div>
      </main>
    </div>
  );
}
