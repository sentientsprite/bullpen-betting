-- Multi-tenant company pools + shareable join links
-- Betting stays anonymous in the UI (no public identity).

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  constraint companies_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$')
);

create index companies_slug_idx on public.companies (slug);

-- ---------------------------------------------------------------------------
-- Memberships
-- ---------------------------------------------------------------------------
create table public.memberships (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id);

-- ---------------------------------------------------------------------------
-- Join intents (anyone with the company link can request access)
-- ---------------------------------------------------------------------------
create table public.join_intents (
  email text not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  primary key (email, company_id)
);

-- Scope markets to a company
alter table public.markets
  add column if not exists company_id uuid references public.companies (id);

create index if not exists markets_company_idx on public.markets (company_id);

-- Active company on profile (session default)
alter table public.profiles
  add column if not exists active_company_id uuid references public.companies (id);

-- Invites become company-scoped (nullable for legacy rows)
alter table public.invites
  add column if not exists company_id uuid references public.companies (id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_company_member(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.company_id = p_company and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_company_admin(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.company_id = p_company
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.is_company_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Bootstrap: create company + join intent + invite, then user OTPs in
-- ---------------------------------------------------------------------------
create or replace function public.create_company(
  p_name text,
  p_slug text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_slug text := lower(trim(p_slug));
  cleaned_email text := lower(trim(p_email));
  cleaned_name text := trim(p_name);
  c public.companies;
begin
  if length(cleaned_name) < 2 then
    raise exception 'Company name too short';
  end if;
  if cleaned_slug !~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$' then
    raise exception 'Slug must be 3–48 chars: lowercase letters, numbers, hyphens';
  end if;
  if cleaned_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'Invalid email';
  end if;
  if exists (select 1 from public.companies where slug = cleaned_slug) then
    raise exception 'That join link is already taken';
  end if;

  insert into public.companies (name, slug)
  values (cleaned_name, cleaned_slug)
  returning * into c;

  insert into public.join_intents (email, company_id)
  values (cleaned_email, c.id)
  on conflict (email, company_id) do update
  set expires_at = now() + interval '24 hours', created_at = now();

  insert into public.invites (email, company_id)
  values (cleaned_email, c.id)
  on conflict (email) do update
  set company_id = excluded.company_id;

  return jsonb_build_object(
    'company', row_to_json(c),
    'join_path', '/join/' || c.slug
  );
end;
$$;

grant execute on function public.create_company(text, text, text) to anon, authenticated;

-- Anyone with the share link can start joining (no pre-seeded invite needed)
create or replace function public.start_join(p_slug text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_slug text := lower(trim(p_slug));
  cleaned_email text := lower(trim(p_email));
  c public.companies;
begin
  if cleaned_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'Invalid email';
  end if;

  select * into c from public.companies where slug = cleaned_slug;
  if not found then
    raise exception 'Company not found';
  end if;

  insert into public.join_intents (email, company_id)
  values (cleaned_email, c.id)
  on conflict (email, company_id) do update
  set expires_at = now() + interval '24 hours', created_at = now();

  insert into public.invites (email, company_id)
  values (cleaned_email, c.id)
  on conflict (email) do update
  set company_id = coalesce(excluded.company_id, public.invites.company_id);

  return jsonb_build_object(
    'company_id', c.id,
    'company_name', c.name,
    'slug', c.slug
  );
end;
$$;

grant execute on function public.start_join(text, text) to anon, authenticated;

create or replace function public.get_company_by_slug(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', id,
    'name', name,
    'slug', slug
  )
  from public.companies
  where slug = lower(trim(p_slug));
$$;

grant execute on function public.get_company_by_slug(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Replace handle_new_user to attach membership from join_intent
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_email text;
  starting_balance bigint := 1000000;
  intent record;
  assigned_role text := 'member';
  member_role text := 'member';
begin
  invite_email := lower(new.email);

  if not exists (select 1 from public.invites where email = invite_email) then
    raise exception 'Invite required for %', invite_email;
  end if;

  -- Prefer pending join intent
  select ji.*, c.id as cid
  into intent
  from public.join_intents ji
  join public.companies c on c.id = ji.company_id
  where ji.email = invite_email
    and ji.expires_at > now()
  order by ji.created_at desc
  limit 1;

  insert into public.profiles (id, email, display_name, role, balance_cents, reserved_cents, active_company_id)
  values (
    new.id,
    invite_email,
    null, -- anonymous: no public display name
    assigned_role,
    starting_balance,
    0,
    intent.company_id
  );

  insert into public.ledger_entries (user_id, amount_cents, kind, note)
  values (new.id, starting_balance, 'grant', 'Starting play-money balance');

  if intent.company_id is not null then
    -- First member of that company becomes owner
    if not exists (
      select 1 from public.memberships where company_id = intent.company_id
    ) then
      member_role := 'owner';
      update public.profiles set role = 'admin' where id = new.id;
    end if;

    insert into public.memberships (company_id, user_id, role)
    values (intent.company_id, new.id, member_role)
    on conflict do nothing;

    delete from public.join_intents
    where email = invite_email and company_id = intent.company_id;
  end if;

  update public.invites
  set accepted_at = now()
  where email = invite_email;

  return new;
end;
$$;

-- Existing users joining an additional company after OTP
create or replace function public.complete_join()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  intent record;
  member_role text := 'member';
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select lower(email) into v_email from public.profiles where id = v_user;
  if v_email is null then
    select lower(email) into v_email from auth.users where id = v_user;
  end if;

  select * into intent
  from public.join_intents
  where email = v_email and expires_at > now()
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('joined', false);
  end if;

  if not exists (
    select 1 from public.memberships where company_id = intent.company_id
  ) then
    member_role := 'owner';
  end if;

  insert into public.memberships (company_id, user_id, role)
  values (intent.company_id, v_user, member_role)
  on conflict do nothing;

  update public.profiles
  set active_company_id = intent.company_id,
      role = case when member_role = 'owner' then 'admin' else role end
  where id = v_user;

  delete from public.join_intents
  where email = v_email and company_id = intent.company_id;

  return jsonb_build_object('joined', true, 'company_id', intent.company_id);
end;
$$;

grant execute on function public.complete_join() to authenticated;

create or replace function public.set_active_company(p_company_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'Not a member of that company';
  end if;
  update public.profiles
  set active_company_id = p_company_id
  where id = auth.uid()
  returning * into p;
  return p;
end;
$$;

grant execute on function public.set_active_company(uuid) to authenticated;

-- Patch create_market_with_order to set company_id from active company
create or replace function public.create_market_with_order(
  p_question text,
  p_description text,
  p_side text,
  p_price_cents int,
  p_qty int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  m public.markets;
  result jsonb;
  v_company uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if length(trim(p_question)) < 8 then
    raise exception 'Question too short';
  end if;

  select active_company_id into v_company from public.profiles where id = v_user;
  if v_company is null then
    raise exception 'Join or create a company pool first';
  end if;
  if not public.is_company_member(v_company) then
    raise exception 'Not a member of the active company';
  end if;

  insert into public.markets (question, description, status, created_by, company_id)
  values (trim(p_question), nullif(trim(p_description), ''), 'proposed', v_user, v_company)
  returning * into m;

  result := public.place_order(m.id, p_side, p_price_cents, p_qty);
  result := result || jsonb_build_object('market', row_to_json(m));
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.memberships enable row level security;
alter table public.join_intents enable row level security;

create policy companies_select_member on public.companies
  for select to authenticated
  using (public.is_company_member(id));

-- Slug lookup is via security definer RPC for anon

create policy memberships_select_own_company on public.memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_company_member(company_id)
  );

-- Tighten markets: members of company only (keep open if company_id null for legacy)
drop policy if exists markets_select on public.markets;
create policy markets_select on public.markets
  for select to authenticated
  using (
    company_id is null
    or public.is_company_member(company_id)
  );

grant select on public.companies to authenticated;
grant select on public.memberships to authenticated;
