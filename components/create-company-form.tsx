"use client";

import { useMemo, useState, useTransition } from "react";
import { createCompany, verifyEmailOtp } from "@/lib/actions";

export function CreateCompanyForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const suggested = useMemo(
    () =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48),
    [name],
  );

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createCompany(fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      if (res && "email" in res && res.email) {
        setEmail(res.email);
        if (res.slug) setSlug(res.slug);
        setSent(true);
      }
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
          Company created. Enter the code sent to{" "}
          <span className="font-medium text-ink">{email}</span>.
        </p>
        <p className="rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm">
          Share link: /join/{slug || suggested}
        </p>
        <form onSubmit={onVerify} className="space-y-4">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value="/dashboard" />
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
            {pending ? "Verifying…" : "Enter your pool"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={onCreate} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-muted">
          Company name
        </span>
        <input
          name="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(
              e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "")
                .slice(0, 48),
            );
          }}
          placeholder="Acme Corp"
          className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-muted">
          Join link slug
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-muted">/join/</span>
          <input
            name="slug"
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            placeholder={suggested || "acme"}
            className="w-full rounded-md border border-line bg-paper px-3 py-2.5 font-mono text-sm outline-none focus:border-brand"
          />
        </div>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-muted">
          Your email
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
        {pending ? "Creating…" : "Create company pool"}
      </button>
      <p className="text-xs text-ink-muted">
        Anyone with your /join link can enter their email and get a login code.
        Betting is 100% anonymous inside the pool.
      </p>
    </form>
  );
}
