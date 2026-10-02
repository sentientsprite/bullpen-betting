import Link from "next/link";
import { SignInForm } from "@/components/sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-16">
      <Link
        href="/"
        className="mb-8 font-display text-3xl font-bold tracking-tight text-brand"
      >
        Floor
      </Link>
      <h1 className="font-display text-2xl text-ink">Team sign in</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Email-only access for invited teammates.
      </p>
      <div className="mt-8">
        <SignInForm
          next={params.next || "/dashboard"}
          errorParam={params.error}
        />
      </div>
    </main>
  );
}
