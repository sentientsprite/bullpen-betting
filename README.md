# Floor

Invite-only internal prediction markets for your team — Kalshi-style Yes/No contracts, play-money balances, honor-system admin resolution.

**Not real gambling.** Money only exists as in-app ledger credits.

## Features

- **Email invites only** — magic-link sign-in; no public signup
- **Free mode or Linked** — default play-money Free mode, or connect **Cash App** / **Robinhood** and switch to Linked
- **Suggest → confirm → live** — a market goes live after **two other** teammates place bets
- **Complementary CLOB** — buy Yes @ P matches buy No @ (100−P); maker price priority
- **In-app ledger** — $10,000 starting balance; reserves, fills, and settlements audited (no real ACH/transfers)
- **Admin resolution** — designated admins settle Yes/No on the real-world outcome (honor system)

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Auth + Postgres + RLS)
- Vercel-ready

## Setup

See **[SETUP.md](SETUP.md)** for the full checklist (Auth URLs, SMTP, email templates, troubleshooting).

### Quick start

#### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com)
2. Run the SQL migrations in order from [`supabase/migrations/`](supabase/migrations/) in the SQL editor
3. Auth → URL configuration: Site URL `http://localhost:3000`, Redirect `http://localhost:3000/**`
4. Enable Email provider; paste branded template from [`supabase/email-templates/magic-link.html`](supabase/email-templates/magic-link.html) when ready

#### 2. Seed the first invite

```sql
insert into public.invites (email) values ('you@company.com');
```

Invites do **not** send email — they only authorize that address to request a login code.

### 3. Configure env

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; optional for most RPCs which use `auth.uid()`)
- `NEXT_PUBLIC_SITE_URL` (e.g. `http://localhost:3000`)

### 4. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Tests

```bash
npm test
```

## Wallet modes

| Mode | Behavior |
|------|----------|
| **Free** (default) | Play-money credits only; no external account needed |
| **Linked** | Requires a connected Cash App `$cashtag` or Robinhood username/email before trading |

Connections store a handle for the team — they do **not** authorize payments, move funds, or talk to Cash App / Robinhood APIs. Settlements always stay on Floor’s ledger.

Manage this under **Wallet** (`/settings`) after sign-in.

## Product rules (v1)

| Rule | Behavior |
|------|----------|
| Access | Invited email + magic link |
| Starting balance | 1,000,000¢ ($10,000.00 play money) |
| Contract | Binary Yes/No; winner pays 100¢ |
| Orders | Limit **buy** Yes or No only |
| Matching | Complementary book; maker sets trade price |
| Go live | Status `proposed` until 2 distinct non-creators have orders |
| Resolve | Admin picks Yes/No; open orders cancelled; winners credited |

## Extract to a standalone portfolio repo

This app was scaffolded under `floor/` inside another repository. To publish it as its own GitHub repo:

```bash
# from the parent monorepo root
git subtree split -P floor -b floor-main
# create an empty GitHub repo, then:
git push git@github.com:YOU/floor.git floor-main:main
```

Or copy the `floor/` directory into a new repo and `git init`.

## Deploy (Vercel)

1. Import the Floor repo (or set Root Directory to `floor` if still nested)
2. Add the same env vars
3. Deploy
4. Add the production URL to Supabase Auth redirect allow-list

## Disclaimer

Floor is an internal team tool for play-money forecasting. It does not process real payments, withdraw funds, or facilitate gambling with real money.
