"use client";

import { useState, useTransition } from "react";
import { signInWithEmail, verifyEmailOtp } from "@/lib/actions";

export function JoinForm({
  slug,
  companyName,
  next = "/dashboard",
}: {
  slug: string;
  companyName: string;
  next?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function onRequest(e: React.FormEvent<HTMLFormElement>) {
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
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          Code sent to <span className="font-medium text-ink">{email}</span>.
          Betting is anonymous — teammates won&apos;t see your email.
        </p>
        <form onSubmit={onVerify} className="space-y-4">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <input
            name="token"
            required
            inputMode="numeric"
            placeholder="123456"
            className="w-full rounded-md border border-line bg-paper px-3 py-2.5 font-mono text-sm tracking-widest outline-none focus:border-brand"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
          >
            {pending ? "Joining…" : `Join ${companyName}`}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={onRequest} className="space-y-4">
      <input type="hidden" name="company_slug" value={slug} />
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-muted">
          Work email
        </span>
        <input
          name="email"
          type="email"
          required
          placeholder="you@company.com"
          className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
      >
        {pending ? "Sending…" : "Email me a login code"}
      </button>
    </form>
  );
}
