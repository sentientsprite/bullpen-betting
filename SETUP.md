# Floor / Bullpen — setup checklist

## Model

- Each **company pool** has a shareable link: `/join/your-slug`
- Anyone with the link enters **email → OTP** and joins that pool
- **Betting is anonymous** (emails never shown on markets)
- Invites table is auto-filled by the join flow (no separate invite email)

## Must have now

### 1. Migrations
Run **all** SQL files in `supabase/migrations/` in order, including:
- `20261005120000_companies.sql`

### 2. Auth → URL configuration
| Setting | Values to add |
|--------|----------------|
| Site URL | `http://localhost:3000` (desktop) **or** `http://YOUR_LAN_IP:3000` (phones on Wi‑Fi) |
| Redirect URLs | `http://localhost:3000/**` |
| | `http://127.0.0.1:3000/**` |
| | `http://YOUR_LAN_IP:3000/**` (e.g. `http://192.168.1.119:3000/**`) |

`YOUR_LAN_IP` is the **Network:** URL Next prints when you run `npm run dev`.

### 3. `.env.local`
```bash
NEXT_PUBLIC_SUPABASE_URL=https://dcujrkcwprvmbepprzeu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# Phones on same Wi‑Fi: use LAN IP so magic links work
NEXT_PUBLIC_SITE_URL=http://192.168.1.119:3000
```

For desktop-only, `http://localhost:3000` is fine. Prefer **OTP code entry** either way.

### 4. Create your company pool
1. Open `/start`
2. Company name + slug + your email
3. Enter OTP → you’re owner/admin
4. Share `/join/your-slug` (also on Dashboard / Settings / Invites)

### 5. Teammates
They open the join link → email → OTP → in. No pre-seeded invite row needed.

---

## Worth adding soon

### Branded auth email
Paste [`supabase/email-templates/magic-link.html`](supabase/email-templates/magic-link.html) into Auth → Email templates → Magic Link.

### Custom SMTP
If OTP email never arrives (common on free Supabase mail), add Resend/Postmark under Project Settings → Auth → SMTP.

### Rate limits / JWT
Keep defaults for an internal team.

### Production
Add `https://YOUR_DOMAIN/**` to redirect URLs and set `NEXT_PUBLIC_SITE_URL` on Vercel.

### Service role
Optional server-only `SUPABASE_SERVICE_ROLE_KEY` — never `NEXT_PUBLIC_`.

---

## Sync into bullpen-betting

```bash
cd ~/POLYMR-trading-bot
git fetch origin cursor/floor-internal-markets-b489 && git checkout cursor/floor-internal-markets-b489 && git pull
git subtree split -P floor -b bullpen-main
git push https://github.com/sentientsprite/bullpen-betting.git bullpen-main:main --force
cd ~/POLYMR-trading-bot/bullpen-betting && git pull
```

Then run the **new** companies migration in Supabase SQL Editor.
