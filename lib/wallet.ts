import type { PaymentConnection, Profile, WalletMode } from "@/lib/types";

export function walletModeLabel(mode: WalletMode | undefined): string {
  return mode === "linked" ? "Linked" : "Free mode";
}

export function providerLabel(provider: "cashapp" | "robinhood"): string {
  return provider === "cashapp" ? "Cash App" : "Robinhood";
}

export function hasActiveConnection(
  connections: PaymentConnection[] | null | undefined,
): boolean {
  return (connections ?? []).some((c) => c.status === "connected");
}

/** Linked mode needs a live Cash App or Robinhood connection to trade. */
export function canTrade(
  profile: Pick<Profile, "wallet_mode">,
  connections: PaymentConnection[] | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (profile.wallet_mode !== "linked") return { ok: true };
  if (hasActiveConnection(connections)) return { ok: true };
  return {
    ok: false,
    reason: "Linked mode requires a Cash App or Robinhood connection.",
  };
}
