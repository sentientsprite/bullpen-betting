import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getActiveCompany, getProfile } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function InvitesAdminPage() {
  const profile = await getProfile();
  if (!profile) redirect("/sign-in");
  if (profile.role !== "admin") redirect("/dashboard");

  const company = await getActiveCompany();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const joinUrl = company?.slug
    ? `${siteUrl.replace(/\/$/, "")}/join/${company.slug}`
    : null;

  return (
    <div className="min-h-screen">
      <AppHeader profile={profile} active="invites" />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl text-brand">Invite teammates</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Share the company join link. Anyone who opens it can enter their email,
          get a login code, and join this anonymous pool.
        </p>

        {joinUrl ? (
          <div className="mt-8 rounded-lg border border-line bg-surface p-5">
            <div className="text-xs uppercase tracking-wider text-ink-muted">
              {company?.name} join link
            </div>
            <p className="mt-2 break-all font-mono text-sm text-ink">{joinUrl}</p>
            <p className="mt-3 text-xs text-ink-muted">
              Tip: for phones on the same Wi‑Fi, set{" "}
              <code>NEXT_PUBLIC_SITE_URL</code> to your Mac&apos;s network URL
              (shown when you run <code>npm run dev</code>).
            </p>
          </div>
        ) : (
          <p className="mt-8 text-sm text-ink-muted">
            No active company. Create one at{" "}
            <a href="/start" className="text-brand underline">
              /start
            </a>
            .
          </p>
        )}
      </main>
    </div>
  );
}
