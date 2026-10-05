import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { WalletSettings } from "@/components/wallet-settings";
import {
  getActiveCompany,
  getPaymentConnections,
  getProfile,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/sign-in");
  const [connections, company] = await Promise.all([
    getPaymentConnections(),
    getActiveCompany(),
  ]);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const joinUrl = company?.slug
    ? `${siteUrl.replace(/\/$/, "")}/join/${company.slug}`
    : null;

  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} active="settings" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl text-brand">Wallet & pool</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Share your company join link. Betting stays anonymous. Choose Free or
          Linked wallet mode.
        </p>

        {company && joinUrl && (
          <section className="mt-8 rounded-lg border border-line bg-surface p-5">
            <h2 className="font-display text-lg text-brand">{company.name}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Anyone with this link can enter their email and join this pool.
            </p>
            <p className="mt-3 break-all rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm text-ink">
              {joinUrl}
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              Set <code>NEXT_PUBLIC_SITE_URL</code> to your LAN or production URL
              so magic links open on phones (e.g. http://192.168.1.119:3000).
            </p>
          </section>
        )}

        <div className="mt-8">
          <WalletSettings profile={profile} connections={connections} />
        </div>
      </main>
    </div>
  );
}
