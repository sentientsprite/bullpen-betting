"use client";

import { useState, useTransition } from "react";
import { signInWithEmail, verifyEmailOtp } from "@/lib/actions";

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
        ? "Sign-in link expired or invalid. Request a new code below."
        : null,
  );
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function onRequestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const value = String(fd.get("email") ?? "").trim().toLowerCase();
    startTransition(async () => {
      const res = await signInWithEmail(fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setEmail(value);
      setSent(true);
    });
  }

  function onVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await verifyEmailOtp(fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
      }
    });
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-signal/30 bg-signal-soft/50 p-4">
          <h2 className="font-display text-xl text-brand">Enter your code</h2>
          <p className="mt-2 text-sm text-ink-muted">
            We sent a one-time code to <span className="font-medium text-ink">{email}</span>.
            Check spam / promotions. Prefer the code over the magic link for local
            setup.
          </p>
        </div>
        <form onSubmit={onVerify} className="space-y-4">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-muted">
              Login code
            </span>
            <input
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              placeholder="123456"
              className="w-full rounded-md border border-line bg-paper px-3 py-2.5 font-mono text-sm tracking-widest outline-none focus:border-brand"
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
            {pending ? "Verifying…" : "Sign in"}
          </button>
          <button
            type="button"
            className="w-full text-xs text-ink-muted underline-offset-2 hover:underline"
            onClick={() => {
              setSent(false);
              setError(null);
            }}
          >
            Use a different email
          </button>
        </form>
        <p className="text-xs text-ink-muted">
          No email? In Supabase go to <strong>Authentication → Logs</strong> and
          confirm the send. Free-tier mail often hits spam or is delayed — add
          custom SMTP (see SETUP.md).
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onRequestCode} className="space-y-4">
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
        {pending ? "Sending…" : "Email me a login code"}
      </button>
      <p className="text-center text-xs text-ink-muted">
        Invite-only (row in Supabase <code>invites</code> — no invite email is
        sent). Play money only.
      </p>
    </form>
  );
}
