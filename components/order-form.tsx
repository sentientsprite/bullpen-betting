"use client";

import { useState, useTransition } from "react";
import { placeOrder } from "@/lib/actions";
import type { OutcomeSide } from "@/lib/types";

export function OrderForm({
  marketId,
  disabled,
}: {
  marketId: string;
  disabled?: boolean;
}) {
  const [side, setSide] = useState<OutcomeSide>("yes");
  const [price, setPrice] = useState(50);
  const [qty, setQty] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await placeOrder(fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setFlash(true);
      setTimeout(() => setFlash(false), 900);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`space-y-4 rounded-lg border border-line bg-surface p-4 ${flash ? "animate-flash" : ""}`}
    >
      <input type="hidden" name="market_id" value={marketId} />
      <input type="hidden" name="side" value={side} />

      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-muted">
          Side
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setSide("yes")}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              side === "yes"
                ? "bg-signal text-white"
                : "border border-line bg-paper text-ink hover:border-signal"
            }`}
          >
            Buy Yes
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setSide("no")}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              side === "no"
                ? "bg-danger text-white"
                : "border border-line bg-paper text-ink hover:border-danger"
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
            value={price}
            disabled={disabled}
            onChange={(e) => setPrice(Number(e.target.value))}
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
            value={qty}
            disabled={disabled}
            onChange={(e) => setQty(Number(e.target.value))}
            className="w-full rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm outline-none focus:border-brand"
          />
        </label>
      </div>

      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span>Cost</span>
        <span className="font-mono text-ink">
          ${((price * qty) / 100).toFixed(2)} play money
        </span>
      </div>

      {error && (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || pending}
        className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-brand-glow disabled:opacity-50"
      >
        {pending ? "Placing…" : disabled ? "Market closed" : "Place limit order"}
      </button>
    </form>
  );
}
