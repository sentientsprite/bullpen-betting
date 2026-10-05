import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(15,61,46,0.18),_transparent_55%)]" />

      <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="font-display text-xl font-bold tracking-tight text-brand">
          Floor
        </span>
        <Link
          href="/sign-in"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-paper transition hover:bg-brand-glow"
        >
          Team sign in
        </Link>
      </nav>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pb-24 pt-10 sm:px-6">
        <p className="animate-rise font-display text-[clamp(4.5rem,18vw,11rem)] font-extrabold leading-[0.85] tracking-tight text-brand">
          Floor
        </p>
        <h1 className="animate-rise-delay mt-6 max-w-2xl font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
          Internal markets for questions your team actually cares about.
        </h1>
        <p className="animate-rise-delay-2 mt-4 max-w-xl text-lg text-ink-muted">
          Kalshi-style Yes/No contracts for your company pool. Share a /join
          link — any email can request a code. Betting is anonymous. Free play
          money, or link Cash App / Robinhood. Not real gambling.
        </p>
        <div className="animate-rise-delay-2 mt-8 flex flex-wrap gap-3">
          <Link
            href="/start"
            className="rounded-md bg-brand px-5 py-3 text-sm font-semibold text-paper transition hover:bg-brand-glow"
          >
            Start a company pool
          </Link>
          <Link
            href="/sign-in"
            className="rounded-md border border-line bg-surface px-5 py-3 text-sm font-medium text-ink transition hover:border-brand"
          >
            Team sign in
          </Link>
        </div>
      </section>

      <section
        id="how"
        className="relative z-10 border-t border-line/70 bg-surface/80"
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
          <Step
            n="01"
            title="Start a company pool"
            body="Create your team space and get a shareable /join link."
          />
          <Step
            n="02"
            title="Anyone with the link"
            body="Teammates enter their email, get a login code, and join. Betting stays anonymous."
          />
          <Step
            n="03"
            title="Suggest & confirm"
            body="Propose a market with your first bet. Two more confirm and it goes live."
          />
          <Step
            n="04"
            title="Trade & resolve"
            body="Limit orders on a complementary book. Admins settle on the real outcome."
          />
        </div>
      </section>

      <footer className="relative z-10 border-t border-line/70 px-4 py-6 text-center text-xs text-ink-muted sm:px-6">
        Floor · play money only · not a real-money gambling product
      </footer>
    </main>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="font-mono text-xs text-amber">{n}</div>
      <h2 className="mt-2 font-display text-xl text-brand">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}
