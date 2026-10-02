import Link from "next/link";
import { formatDollars, availableBalance } from "@/lib/money";
import type { Profile } from "@/lib/types";
import { signOut } from "@/lib/actions";

export function AppHeader({
  profile,
  active,
}: {
  profile: Profile;
  active?: "dashboard" | "new" | "portfolio" | "invites";
}) {
  const avail = availableBalance(profile.balance_cents, profile.reserved_cents);

  return (
    <header className="border-b border-line/80 bg-surface backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-display text-2xl tracking-tight text-brand">
            Floor
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-ink-muted sm:flex">
            <NavLink href="/dashboard" active={active === "dashboard"}>
              Markets
            </NavLink>
            <NavLink href="/markets/new" active={active === "new"}>
              Suggest
            </NavLink>
            <NavLink href="/portfolio" active={active === "portfolio"}>
              Portfolio
            </NavLink>
            {profile.role === "admin" && (
              <NavLink href="/admin/invites" active={active === "invites"}>
                Invites
              </NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="animate-balance rounded-md border border-line bg-paper px-3 py-1.5 text-right">
            <div className="font-mono text-sm font-medium text-ink">
              {formatDollars(avail)}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">
              Play money
            </div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
      <nav className="flex gap-4 overflow-x-auto border-t border-line/70 px-4 py-2 text-xs text-ink-muted sm:hidden">
        <NavLink href="/dashboard" active={active === "dashboard"}>
          Markets
        </NavLink>
        <NavLink href="/markets/new" active={active === "new"}>
          Suggest
        </NavLink>
        <NavLink href="/portfolio" active={active === "portfolio"}>
          Portfolio
        </NavLink>
        {profile.role === "admin" && (
          <NavLink href="/admin/invites" active={active === "invites"}>
            Invites
          </NavLink>
        )}
      </nav>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "font-medium text-brand"
          : "hover:text-ink transition-colors"
      }
    >
      {children}
    </Link>
  );
}
