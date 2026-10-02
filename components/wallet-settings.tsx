"use client";

import { useState, useTransition } from "react";
import {
  connectPayment,
  disconnectPayment,
  setWalletMode,
} from "@/lib/actions";
import { providerLabel } from "@/lib/wallet";
import type { PaymentConnection, Profile, WalletMode } from "@/lib/types";

export function WalletSettings({
  profile,
  connections,
}: {
  profile: Profile;
  connections: PaymentConnection[];
}) {
  const active = connections.filter((c) => c.status === "connected");
  const cashapp = active.find((c) => c.provider === "cashapp");
  const robinhood = active.find((c) => c.provider === "robinhood");

  return (
    <div className="space-y-8">
      <ModePicker mode={profile.wallet_mode ?? "free"} hasLink={active.length > 0} />

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="font-display text-lg text-brand">Linked accounts</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Connect Cash App or Robinhood by handle. Floor still tracks balances
          in-app only — this does not move real money or authorize withdrawals.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <ProviderCard
            provider="cashapp"
            title="Cash App"
            blurb="Link your $Cashtag so teammates know which Cash App you use."
            placeholder="$yourcashtag"
            connection={cashapp}
          />
          <ProviderCard
            provider="robinhood"
            title="Robinhood"
            blurb="Link your Robinhood username or login email."
            placeholder="username or email"
            connection={robinhood}
          />
        </div>
      </section>
    </div>
  );
}

function ModePicker({
  mode,
  hasLink,
}: {
  mode: WalletMode;
  hasLink: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: WalletMode) {
    setError(null);
    const fd = new FormData();
    fd.set("mode", next);
    startTransition(async () => {
      const res = await setWalletMode(fd);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h2 className="font-display text-lg text-brand">Wallet mode</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Free mode uses play-money credits only. Linked mode requires a Cash App
        or Robinhood connection before you can trade.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ModeButton
          active={mode === "free"}
          disabled={pending}
          title="Free mode"
          body="Default play-money ledger. No external account needed."
          onClick={() => choose("free")}
        />
        <ModeButton
          active={mode === "linked"}
          disabled={pending || !hasLink}
          title="Linked"
          body={
            hasLink
              ? "Trade with your in-app balance while showing a linked account."
              : "Connect Cash App or Robinhood below, then enable Linked."
          }
          onClick={() => choose("linked")}
        />
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </section>
  );
}

function ModeButton({
  active,
  disabled,
  title,
  body,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-4 py-4 text-left transition ${
        active
          ? "border-brand bg-signal-soft/40 shadow-[inset_0_0_0_1px_var(--brand)]"
          : "border-line bg-paper hover:border-brand"
      } disabled:opacity-50`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-base text-brand">{title}</span>
        {active && (
          <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-paper">
            On
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-ink-muted">{body}</p>
    </button>
  );
}

function ProviderCard({
  provider,
  title,
  blurb,
  placeholder,
  connection,
}: {
  provider: "cashapp" | "robinhood";
  title: string;
  blurb: string;
  placeholder: string;
  connection?: PaymentConnection;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConnect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await connectPayment(fd);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  function onDisconnect() {
    setError(null);
    const fd = new FormData();
    fd.set("provider", provider);
    startTransition(async () => {
      const res = await disconnectPayment(fd);
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base text-ink">{title}</h3>
          <p className="mt-1 text-xs text-ink-muted">{blurb}</p>
        </div>
        {connection && (
          <span className="rounded bg-signal-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-signal">
            Connected
          </span>
        )}
      </div>

      {connection ? (
        <div className="mt-4 space-y-3">
          <div className="font-mono text-sm text-ink">{connection.handle}</div>
          <button
            type="button"
            disabled={pending}
            onClick={onDisconnect}
            className="text-xs text-danger underline-offset-2 hover:underline disabled:opacity-50"
          >
            Disconnect {providerLabel(provider)}
          </button>
        </div>
      ) : (
        <form onSubmit={onConnect} className="mt-4 space-y-3">
          <input type="hidden" name="provider" value={provider} />
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-ink-muted">
              {provider === "cashapp" ? "Cashtag" : "Username / email"}
            </span>
            <input
              name="handle"
              required
              placeholder={placeholder}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-brand"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-paper hover:bg-brand-glow disabled:opacity-50"
          >
            {pending ? "Connecting…" : `Connect ${title}`}
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
