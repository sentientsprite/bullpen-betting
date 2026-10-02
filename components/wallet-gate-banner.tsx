import Link from "next/link";

export function WalletGateBanner({ reason }: { reason: string }) {
  return (
    <div className="rounded-lg border border-amber/40 bg-amber-soft/50 px-4 py-3 text-sm text-ink">
      <p>{reason}</p>
      <Link
        href="/settings"
        className="mt-2 inline-block font-medium text-brand underline-offset-2 hover:underline"
      >
        Open wallet settings →
      </Link>
    </div>
  );
}
