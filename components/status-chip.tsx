import type { MarketStatus } from "@/lib/types";

const LABELS: Record<MarketStatus, string> = {
  proposed: "Needs confirmations",
  live: "Live",
  resolved: "Resolved",
  cancelled: "Cancelled",
};

export function StatusChip({
  status,
  confirmations,
  required = 2,
}: {
  status: MarketStatus;
  confirmations?: number;
  required?: number;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide";

  if (status === "live") {
    return (
      <span className={`${base} animate-live bg-signal-soft text-signal`}>
        <span className="h-1.5 w-1.5 rounded-full bg-signal" />
        {LABELS.live}
      </span>
    );
  }
  if (status === "proposed") {
    return (
      <span className={`${base} bg-amber-soft text-amber`}>
        {LABELS.proposed}
        {typeof confirmations === "number" && (
          <span className="font-mono normal-case tracking-normal">
            {confirmations}/{required}
          </span>
        )}
      </span>
    );
  }
  if (status === "resolved") {
    return (
      <span className={`${base} bg-paper-2 text-ink-muted`}>{LABELS.resolved}</span>
    );
  }
  return (
    <span className={`${base} bg-paper-2 text-ink-muted`}>{LABELS.cancelled}</span>
  );
}
