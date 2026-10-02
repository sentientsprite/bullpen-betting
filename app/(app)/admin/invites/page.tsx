import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { InviteForm } from "@/components/invite-form";
import { getProfile } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import type { Invite } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvitesAdminPage() {
  const profile = await getProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("invites")
    .select("*")
    .order("created_at", { ascending: false });

  const invites = (data ?? []) as Invite[];

  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} active="invites" />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl text-brand">Invites</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Email-only access. Add a teammate&apos;s work email so they can request
          a magic link.
        </p>

        <div className="mt-8 rounded-lg border border-line bg-surface p-5">
          <InviteForm />
        </div>

        <ul className="mt-8 divide-y divide-line border border-line bg-surface">
          {invites.map((inv) => (
            <li
              key={inv.email}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <span className="font-medium text-ink">{inv.email}</span>
              <span className="font-mono text-xs text-ink-muted">
                {inv.accepted_at
                  ? `Joined ${new Date(inv.accepted_at).toLocaleDateString()}`
                  : "Pending"}
              </span>
            </li>
          ))}
          {invites.length === 0 && (
            <li className="px-4 py-6 text-sm text-ink-muted">
              No invites yet. Seed your own email in Supabase SQL to become the
              first admin.
            </li>
          )}
        </ul>
      </main>
    </div>
  );
}
