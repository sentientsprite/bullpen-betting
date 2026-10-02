"use client";

import { useState, useTransition } from "react";
import { signInWithEmail } from "@/lib/actions";

export function SignInForm({
  next,
  errorParam,
}: {
  next: string;
  errorParam?: string | null;
}) {
  const [error, setError] = useState<string | null>(
    errorParam === "invite_required"
      ? "Your email is not on the invite list."
      : errorParam === "auth_callback"
        ? "Sign-in link expired or invalid. Try again."
        : null,
  );
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await signInWithEmail(fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="animate-rise rounded-lg border border-signal/30 bg-signal-soft/50 p-6 text-center">
        <h2 className="font-display text-xl text-brand">Check your inbox</h2>
        <p className="mt-2 text-sm text-ink-muted">
          We sent a magic link. Open it to step onto the Floor.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-muted">
          Work email
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
      </label>
      {error && (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-paper hover:bg-brand-glow disabled:opacity-50"
      >
        {pending ? "Sending…" : "Email me a magic link"}
      </button>
      <p className="text-center text-xs text-ink-muted">
        Invite-only. No public signup. Play money only — not real gambling.
      </p>
    </form>
  );
}
