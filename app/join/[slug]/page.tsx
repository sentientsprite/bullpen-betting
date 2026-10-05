import Link from "next/link";
import { notFound } from "next/navigation";
import { JoinForm } from "@/components/join-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function JoinCompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_company_by_slug", {
    p_slug: slug,
  });

  if (!data) notFound();
  const company = data as { id: string; name: string; slug: string };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16">
      <Link href="/" className="mb-8 font-display text-3xl font-bold text-brand">
        Floor
      </Link>
      <h1 className="font-display text-2xl text-ink">Join {company.name}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Enter your email for a login code. Markets in this pool are anonymous —
        other traders never see who you are.
      </p>
      <div className="mt-8 rounded-lg border border-line bg-surface p-5">
        <JoinForm slug={company.slug} companyName={company.name} />
      </div>
    </main>
  );
}
