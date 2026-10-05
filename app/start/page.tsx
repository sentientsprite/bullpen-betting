import Link from "next/link";
import { CreateCompanyForm } from "@/components/create-company-form";

export default function StartCompanyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16">
      <Link href="/" className="mb-8 font-display text-3xl font-bold text-brand">
        Floor
      </Link>
      <h1 className="font-display text-2xl text-ink">Start a company pool</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Create your team&apos;s private markets. You&apos;ll get a shareable
        /join link — anyone with it can sign in with email.
      </p>
      <div className="mt-8 rounded-lg border border-line bg-surface p-5">
        <CreateCompanyForm />
      </div>
    </main>
  );
}
