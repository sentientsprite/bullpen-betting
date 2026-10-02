"use client";

import { useState, useTransition } from "react";
import { resolveMarket } from "@/lib/actions";
import type { OutcomeSide } from "@/lib/types";

export function ResolvePanel({ marketId }: { marketId: string }) {
  const [outcome, setOutcome] = useState<OutcomeSide>("yes");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      !confirm(
        `Resolve this market as ${outcome.toUpperCase()}? This settles all positions (honor system).`,
      )
    ) {
      return;
    }
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await resolveMarket(fd);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-amber/40 bg-amber-soft/40 p-4"
    >
      <div>
        <h2 className="font-display text-lg text-brand">Resolve market</h2>
        <p className="text-xs text-ink-muted">
          Admin only · honor system · based on the real-world outcome
        </p>
      </div>
      <input type="hidden" name="market_id" value={marketId} />
      <input type="hidden" name="outcome" value={outcome} />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setOutcome("yes")}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            outcome === "yes" ? "bg-signal text-white" : "border border-line bg-paper"
          }`}
        >
          Yes wins
        </button>
        <button
          type="button"
          onClick={() => setOutcome("no")}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            outcome === "no" ? "bg-danger text-white" : "border border-line bg-paper"
          }`}
        >
          No wins
        </button>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-ink-muted">
          Note (optional)
        </span>
        <input
          name="note"
          placeholder="Source / rationale"
          className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
      >
        {pending ? "Resolving…" : "Confirm resolution"}
      </button>
    </form>
  );
}
