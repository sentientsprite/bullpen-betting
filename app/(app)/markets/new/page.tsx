import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SuggestMarketForm } from "@/components/suggest-market-form";
import { getProfile } from "@/lib/actions";

export default async function NewMarketPage() {
  const profile = await getProfile();
  if (!profile) redirect("/sign-in");

  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} active="new" />
      <main className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl text-brand">Suggest a market</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Pose a Yes/No question and place the opening bet. The pool goes live
          after two other teammates confirm with their own bets.
        </p>
        <div className="mt-8 rounded-lg border border-line bg-surface p-5">
          <SuggestMarketForm />
        </div>
      </main>
    </div>
  );
}
