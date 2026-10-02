# Floor / Bullpen — setup checklist

Invite rows do **not** send email. They only allow that address to request a login code.
The email you wait for is the **OTP / magic link** from Supabase Auth after you submit the sign-in form.

## Must have now

### 1. Migrations
Run all files in `supabase/migrations/` in the Supabase SQL Editor (in order).

### 2. Seed invite
```sql
insert into public.invites (email) values ('raymondk@onlineimage.com');
-- verify:
select * from public.invites;
```

### 3. Auth → URL configuration
| Setting | Local value |
|--------|-------------|
| Site URL | `http://localhost:3000` |
| Redirect URLs | `http://localhost:3000/**` |
| | `http://localhost:3000/auth/callback` |
| | `http://127.0.0.1:3000/**` |

Add `127.0.0.1` variants if you open that host instead of `localhost`.

### 4. Auth → Providers → Email
- Enable **Email**
- Enable **Confirm email** if shown
- Magic link / OTP: leave enabled (default)

### 5. `.env.local`
```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# optional for scripts only — never expose to the browser
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Restart `npm run dev` after any env change.

### 6. Sign in
1. Open `http://localhost:3000/sign-in`
2. Enter the invited email → **Email me a login code**
3. Enter the **6–8 digit code** from the email (or spam)
4. First successful user becomes **admin**

---

## Worth adding soon

### Branded auth email
Supabase → **Authentication → Email templates → Magic Link**  
Paste HTML from [`supabase/email-templates/magic-link.html`](supabase/email-templates/magic-link.html).  
Subject suggestion: `Your Floor login code`

Also update **Confirm signup** / **Invite user** templates if you use them later.

### Rate limits
Supabase → **Authentication → Rate Limits**  
Keep defaults for an internal team. Raise only if teammates hit “email rate limit exceeded”.

### JWT expiry
Supabase → **Authentication → Settings → JWT expiry**  
Default (~1 hour) is fine. Longer sessions = less re-login for a desk app; shorter = safer on shared machines.

### Production redirects (when you deploy)
Add to Redirect URLs:
- `https://YOUR_DOMAIN/auth/callback`
- `https://YOUR_DOMAIN/**`

Set `NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN` in Vercel env.

### Custom SMTP (fix email doesn’t arrive)
Supabase free email is unreliable (spam / delay / silent drop).

1. Create a Resend / Postmark / SendGrid account  
2. Supabase → **Project Settings → Authentication → SMTP Settings**  
3. Enable custom SMTP and paste host/user/pass/from  
4. Send a test OTP again  

Until then: check **Authentication → Logs** after each sign-in attempt.

### Service role key
Store in `.env.local` / Vercel **server-only** env (no `NEXT_PUBLIC_`).  
Used only for privileged scripts — app RPCs already use `auth.uid()`.

### Keep signup closed
Do **not** enable public signup providers (Google, GitHub, anonymous).  
Access = `invites` row + email OTP only.

---

## Troubleshooting: nothing in inbox

1. Confirm invite: `select * from public.invites where email = 'raymondk@onlineimage.com';`
2. After clicking “Email me a login code”, open **Authentication → Logs** — look for `otp` / `magiclink` send  
3. Check spam / promotions for `noreply@mail.app.supabase.io` (or your SMTP from-address)  
4. Prefer entering the **numeric code** on the sign-in page (more reliable than the magic link locally)  
5. If logs show no send: fix Email provider toggle + SMTP  
6. If logs show send but no mail: add **custom SMTP** (above)

## Sync this app into `bullpen-betting`

From a checkout of `POLYMR-trading-bot` on `cursor/floor-internal-markets-b489`:

```bash
git subtree split -P floor -b bullpen-main
git push https://github.com/sentientsprite/bullpen-betting.git bullpen-main:main --force
```

Then on your Mac: `cd ~/POLYMR-trading-bot/bullpen-betting && git pull`.
