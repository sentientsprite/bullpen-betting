"use client";

import { useState, useTransition } from "react";
import { inviteEmail } from "@/lib/actions";

export function InviteForm() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(false);
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await inviteEmail(fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setOk(true);
      form.reset();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
      <input
        name="email"
        type="email"
        required
        placeholder="teammate@company.com"
        className="flex-1 rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-paper hover:bg-brand-glow disabled:opacity-50"
      >
        {pending ? "Inviting…" : "Send invite"}
      </button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
      {ok && (
        <p className="w-full text-sm text-signal">
          Invite recorded. They can sign in with that email.
        </p>
      )}
    </form>
  );
}
