/** Play-money helpers. All amounts are integer cents. */

export const STARTING_BALANCE_CENTS = 1_000_000; // $10,000.00 play money
export const CONTRACT_PAYOUT_CENTS = 100;

export function formatDollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${rem.toString().padStart(2, "0")}`;
}

export function formatCentsPrice(cents: number): string {
  return `${cents}¢`;
}

export function formatProbability(cents: number): string {
  return `${cents}%`;
}

export function availableBalance(
  balanceCents: number,
  reservedCents: number,
): number {
  return Math.max(0, balanceCents - reservedCents);
}

export function complementaryPrice(yesPriceCents: number): number {
  return CONTRACT_PAYOUT_CENTS - yesPriceCents;
}

export function clampPrice(priceCents: number): number {
  return Math.min(99, Math.max(1, Math.round(priceCents)));
}
