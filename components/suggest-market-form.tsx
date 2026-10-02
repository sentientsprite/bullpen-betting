"use client";

import { useState, useTransition } from "react";
import { createMarket } from "@/lib/actions";
import type { OutcomeSide } from "@/lib/types";

export function SuggestMarketForm() {
  const [side, setSide] = useState<OutcomeSide>("yes");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createMarket(fd);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="side" value={side} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-muted">
          Question
        </span>
        <input
          name="question"
          required
          minLength={8}
          placeholder="Will we ship the redesign before Friday?"
          className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-muted">
          Details (optional)
        </span>
        <textarea
          name="description"
          rows={3}
          placeholder="Resolution criteria, links, deadline…"
          className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
      </label>

      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
          Your opening bet
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSide("yes")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              side === "yes" ? "bg-signal text-white" : "border border-line bg-paper"
            }`}
          >
            Buy Yes
          </button>
          <button
            type="button"
            onClick={() => setSide("no")}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              side === "no" ? "bg-danger text-white" : "border border-line bg-paper"
            }`}
          >
            Buy No
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-muted">
            Price (¢)
          </span>
          <input
            name="price"
            type="number"
            min={1}
            max={99}
            defaultValue={50}
            className="w-full rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-muted">
            Contracts
          </span>
          <input
            name="qty"
            type="number"
            min={1}
            defaultValue={10}
            className="w-full rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm outline-none focus:border-brand"
          />
        </label>
      </div>

      <p className="text-sm text-ink-muted">
        Market stays <strong className="text-ink">proposed</strong> until two
        other teammates place bets — then it goes live.
      </p>

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
        {pending ? "Creating…" : "Suggest market"}
      </button>
    </form>
  );
}
