-- Floor: invite-only internal prediction markets
-- Play-money ledger + Kalshi-style complementary CLOB

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text,
  role text not null default 'member' check (role in ('member', 'admin')),
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  reserved_cents bigint not null default 0 check (reserved_cents >= 0),
  created_at timestamptz not null default now(),
  constraint reserved_lte_balance check (reserved_cents <= balance_cents)
);

-- ---------------------------------------------------------------------------
-- Invites (email-only access)
-- ---------------------------------------------------------------------------
create table public.invites (
  email text primary key,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index invites_invited_by_idx on public.invites (invited_by);

-- ---------------------------------------------------------------------------
-- Markets
-- ---------------------------------------------------------------------------
create table public.markets (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  description text,
  status text not null default 'proposed'
    check (status in ('proposed', 'live', 'resolved', 'cancelled')),
  created_by uuid not null references public.profiles (id),
  resolved_outcome text check (resolved_outcome in ('yes', 'no')),
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index markets_status_idx on public.markets (status);
create index markets_created_by_idx on public.markets (created_by);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  side text not null check (side in ('yes', 'no')),
  price_cents int not null check (price_cents between 1 and 99),
  qty int not null check (qty > 0),
  filled_qty int not null default 0 check (filled_qty >= 0),
  status text not null default 'open'
    check (status in ('open', 'partial', 'filled', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint filled_lte_qty check (filled_qty <= qty)
);

create index orders_market_book_idx
  on public.orders (market_id, side, status, price_cents desc);
create index orders_user_idx on public.orders (user_id);

-- ---------------------------------------------------------------------------
-- Trades
-- ---------------------------------------------------------------------------
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  yes_order_id uuid not null references public.orders (id),
  no_order_id uuid not null references public.orders (id),
  yes_user_id uuid not null references public.profiles (id),
  no_user_id uuid not null references public.profiles (id),
  price_cents int not null check (price_cents between 1 and 99),
  qty int not null check (qty > 0),
  created_at timestamptz not null default now()
);

create index trades_market_idx on public.trades (market_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Positions
-- ---------------------------------------------------------------------------
create table public.positions (
  market_id uuid not null references public.markets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  yes_qty int not null default 0 check (yes_qty >= 0),
  no_qty int not null default 0 check (no_qty >= 0),
  yes_cost_cents bigint not null default 0,
  no_cost_cents bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (market_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_cents bigint not null,
  kind text not null
    check (kind in ('grant', 'reserve', 'release', 'trade', 'settlement')),
  ref_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index ledger_user_idx on public.ledger_entries (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger markets_updated_at
  before update on public.markets
  for each row execute function public.set_updated_at();

create trigger positions_updated_at
  before update on public.positions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth bootstrap: create profile + mark invite on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_email text;
  starting_balance bigint := 1000000; -- $10,000.00 play money
  admin_count int;
  assigned_role text := 'member';
begin
  invite_email := lower(new.email);

  if not exists (select 1 from public.invites where email = invite_email) then
    raise exception 'Invite required for %', invite_email;
  end if;

  select count(*) into admin_count from public.profiles where role = 'admin';
  if admin_count = 0 then
    assigned_role := 'admin';
  end if;

  insert into public.profiles (id, email, display_name, role, balance_cents, reserved_cents)
  values (
    new.id,
    invite_email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(invite_email, '@', 1)),
    assigned_role,
    starting_balance,
    0
  );

  insert into public.ledger_entries (user_id, amount_cents, kind, note)
  values (new.id, starting_balance, 'grant', 'Starting play-money balance');

  update public.invites
  set accepted_at = now()
  where email = invite_email;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.current_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(email) from auth.users where id = auth.uid();
$$;

create or replace function public.count_confirmations(p_market_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(distinct o.user_id), 0)::int
  from public.orders o
  join public.markets m on m.id = o.market_id
  where o.market_id = p_market_id
    and o.user_id <> m.created_by
    and o.status in ('open', 'partial', 'filled');
$$;

create or replace function public.maybe_go_live(p_market_id uuid)
returns public.markets
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.markets;
  conf int;
begin
  select * into m from public.markets where id = p_market_id for update;
  if m.status <> 'proposed' then
    return m;
  end if;
  conf := public.count_confirmations(p_market_id);
  if conf >= 2 then
    update public.markets
    set status = 'live'
    where id = p_market_id
    returning * into m;
  end if;
  return m;
end;
$$;

-- ---------------------------------------------------------------------------
-- Place order + complementary matching (Yes@P ↔ No@(100-P))
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_market_id uuid,
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
  v_order public.orders;
  cost bigint;
  avail bigint;
  rem int;
  maker public.orders;
  fill_qty int;
  yes_price int;
  no_price int;
  yes_oid uuid;
  no_oid uuid;
  yes_uid uuid;
  no_uid uuid;
  trade_id uuid;
  fills jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_side not in ('yes', 'no') then
    raise exception 'Invalid side';
  end if;
  if p_price_cents < 1 or p_price_cents > 99 then
    raise exception 'Price must be 1-99 cents';
  end if;
  if p_qty <= 0 then
    raise exception 'Quantity must be positive';
  end if;

  select * into m from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'Market not found';
  end if;
  if m.status not in ('proposed', 'live') then
    raise exception 'Market is not open for orders';
  end if;

  cost := p_price_cents::bigint * p_qty::bigint;

  update public.profiles
  set reserved_cents = reserved_cents + cost
  where id = v_user
    and (balance_cents - reserved_cents) >= cost
  returning (balance_cents - reserved_cents) into avail;

  if not found then
    raise exception 'Insufficient available balance';
  end if;

  insert into public.ledger_entries (user_id, amount_cents, kind, ref_id, note)
  values (v_user, -cost, 'reserve', p_market_id, 'Reserve for limit order');

  insert into public.orders (market_id, user_id, side, price_cents, qty)
  values (p_market_id, v_user, p_side, p_price_cents, p_qty)
  returning * into v_order;

  rem := p_qty;

  -- Match complementary resting orders (maker price priority)
  for maker in
    select *
    from public.orders o
    where o.market_id = p_market_id
      and o.side = case when p_side = 'yes' then 'no' else 'yes' end
      and o.user_id <> v_user
      and o.status in ('open', 'partial')
      and (o.qty - o.filled_qty) > 0
      and o.price_cents + p_price_cents >= 100
    order by o.price_cents desc, o.created_at asc
    for update
  loop
    exit when rem <= 0;
    fill_qty := least(rem, maker.qty - maker.filled_qty);

    if p_side = 'yes' then
      -- Maker is No @ N; trade at maker price
      no_price := maker.price_cents;
      yes_price := 100 - no_price;
      yes_oid := v_order.id;
      no_oid := maker.id;
      yes_uid := v_user;
      no_uid := maker.user_id;
    else
      -- Maker is Yes @ Y; trade at maker price
      yes_price := maker.price_cents;
      no_price := 100 - yes_price;
      yes_oid := maker.id;
      no_oid := v_order.id;
      yes_uid := maker.user_id;
      no_uid := v_user;
    end if;

    -- Spend from reserved: each side pays their contract price.
    -- Taker may have reserved a worse price — release the improvement.
    update public.profiles
    set
      balance_cents = balance_cents - (yes_price::bigint * fill_qty),
      reserved_cents = reserved_cents - (
        case when yes_uid = v_user then p_price_cents else yes_price end
      )::bigint * fill_qty
    where id = yes_uid;

    update public.profiles
    set
      balance_cents = balance_cents - (no_price::bigint * fill_qty),
      reserved_cents = reserved_cents - (
        case when no_uid = v_user then p_price_cents else no_price end
      )::bigint * fill_qty
    where id = no_uid;

    -- Price improvement release for taker (ledger only; reserved already adjusted)
    if p_side = 'yes' and p_price_cents > yes_price then
      insert into public.ledger_entries (user_id, amount_cents, kind, ref_id, note)
      values (
        v_user,
        (p_price_cents - yes_price)::bigint * fill_qty,
        'release',
        p_market_id,
        'Price improvement'
      );
    elsif p_side = 'no' and p_price_cents > no_price then
      insert into public.ledger_entries (user_id, amount_cents, kind, ref_id, note)
      values (
        v_user,
        (p_price_cents - no_price)::bigint * fill_qty,
        'release',
        p_market_id,
        'Price improvement'
      );
    end if;

    insert into public.ledger_entries (user_id, amount_cents, kind, ref_id, note)
    values
      (yes_uid, -(yes_price::bigint * fill_qty), 'trade', p_market_id, 'Buy Yes fill'),
      (no_uid, -(no_price::bigint * fill_qty), 'trade', p_market_id, 'Buy No fill');

    insert into public.trades (
      market_id, yes_order_id, no_order_id, yes_user_id, no_user_id, price_cents, qty
    ) values (
      p_market_id, yes_oid, no_oid, yes_uid, no_uid, yes_price, fill_qty
    ) returning id into trade_id;

    insert into public.positions (market_id, user_id, yes_qty, yes_cost_cents)
    values (p_market_id, yes_uid, fill_qty, yes_price::bigint * fill_qty)
    on conflict (market_id, user_id) do update
    set
      yes_qty = public.positions.yes_qty + excluded.yes_qty,
      yes_cost_cents = public.positions.yes_cost_cents + excluded.yes_cost_cents,
      updated_at = now();

    insert into public.positions (market_id, user_id, no_qty, no_cost_cents)
    values (p_market_id, no_uid, fill_qty, no_price::bigint * fill_qty)
    on conflict (market_id, user_id) do update
    set
      no_qty = public.positions.no_qty + excluded.no_qty,
      no_cost_cents = public.positions.no_cost_cents + excluded.no_cost_cents,
      updated_at = now();

    update public.orders
    set
      filled_qty = filled_qty + fill_qty,
      status = case
        when filled_qty + fill_qty >= qty then 'filled'
        else 'partial'
      end
    where id = maker.id;

    rem := rem - fill_qty;
    fills := fills || jsonb_build_object(
      'trade_id', trade_id,
      'qty', fill_qty,
      'yes_price_cents', yes_price
    );
  end loop;

  -- Update taker order
  update public.orders
  set
    filled_qty = p_qty - rem,
    status = case
      when rem = 0 then 'filled'
      when rem < p_qty then 'partial'
      else 'open'
    end
  where id = v_order.id
  returning * into v_order;

  -- If taker reserved more than needed for unfilled remainder at their price,
  -- remaining reserve stays for open qty (already reserved full cost; fills
  -- released reserve above). Good.

  perform public.maybe_go_live(p_market_id);

  return jsonb_build_object(
    'order', row_to_json(v_order),
    'fills', fills,
    'confirmations', public.count_confirmations(p_market_id),
    'market_status', (select status from public.markets where id = p_market_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancel open order / release reserve
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  rem int;
  release_amt bigint;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if o.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  if o.status not in ('open', 'partial') then
    raise exception 'Order is not cancellable';
  end if;

  rem := o.qty - o.filled_qty;
  release_amt := rem::bigint * o.price_cents::bigint;

  update public.profiles
  set reserved_cents = reserved_cents - release_amt
  where id = o.user_id;

  insert into public.ledger_entries (user_id, amount_cents, kind, ref_id, note)
  values (o.user_id, release_amt, 'release', o.id, 'Cancel order release');

  update public.orders
  set status = 'cancelled'
  where id = o.id
  returning * into o;

  return o;
end;
$$;

-- ---------------------------------------------------------------------------
-- Create market + initial order
-- ---------------------------------------------------------------------------
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
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if length(trim(p_question)) < 8 then
    raise exception 'Question too short';
  end if;

  insert into public.markets (question, description, status, created_by)
  values (trim(p_question), nullif(trim(p_description), ''), 'proposed', v_user)
  returning * into m;

  result := public.place_order(m.id, p_side, p_price_cents, p_qty);
  result := result || jsonb_build_object('market', row_to_json(m));
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resolve market (admin, honor system)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_market(
  p_market_id uuid,
  p_outcome text,
  p_note text default null
)
returns public.markets
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.markets;
  pos public.positions;
  o public.orders;
  rem int;
  payout bigint;
  release_amt bigint;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_outcome not in ('yes', 'no') then
    raise exception 'Outcome must be yes or no';
  end if;

  select * into m from public.markets where id = p_market_id for update;
  if not found then
    raise exception 'Market not found';
  end if;
  if m.status not in ('proposed', 'live') then
    raise exception 'Market cannot be resolved';
  end if;

  -- Cancel resting orders and release reserves
  for o in
    select * from public.orders
    where market_id = p_market_id and status in ('open', 'partial')
    for update
  loop
    rem := o.qty - o.filled_qty;
    release_amt := rem::bigint * o.price_cents::bigint;
    if release_amt > 0 then
      update public.profiles
      set reserved_cents = greatest(0, reserved_cents - release_amt)
      where id = o.user_id;
      insert into public.ledger_entries (user_id, amount_cents, kind, ref_id, note)
      values (o.user_id, release_amt, 'release', o.id, 'Resolution: release open order');
    end if;
    update public.orders set status = 'cancelled' where id = o.id;
  end loop;

  -- Settle positions: winning side pays 100¢ per contract
  for pos in
    select * from public.positions where market_id = p_market_id for update
  loop
    if p_outcome = 'yes' and pos.yes_qty > 0 then
      payout := pos.yes_qty::bigint * 100;
      update public.profiles
      set balance_cents = balance_cents + payout
      where id = pos.user_id;
      insert into public.ledger_entries (user_id, amount_cents, kind, ref_id, note)
      values (pos.user_id, payout, 'settlement', p_market_id, 'Yes wins');
    elsif p_outcome = 'no' and pos.no_qty > 0 then
      payout := pos.no_qty::bigint * 100;
      update public.profiles
      set balance_cents = balance_cents + payout
      where id = pos.user_id;
      insert into public.ledger_entries (user_id, amount_cents, kind, ref_id, note)
      values (pos.user_id, payout, 'settlement', p_market_id, 'No wins');
    end if;
  end loop;

  update public.markets
  set
    status = 'resolved',
    resolved_outcome = p_outcome,
    resolved_by = auth.uid(),
    resolved_at = now(),
    resolution_note = nullif(trim(p_note), '')
  where id = p_market_id
  returning * into m;

  return m;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invite helper
-- ---------------------------------------------------------------------------
create or replace function public.invite_email(p_email text)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := lower(trim(p_email));
  inv public.invites;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if cleaned !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'Invalid email';
  end if;

  insert into public.invites (email, invited_by)
  values (cleaned, auth.uid())
  on conflict (email) do update
  set invited_by = excluded.invited_by
  returning * into inv;

  return inv;
end;
$$;

-- Bootstrap: allow first invite before any admin exists (service role / SQL)
-- Seed via dashboard: insert into invites (email) values ('you@company.com');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.markets enable row level security;
alter table public.orders enable row level security;
alter table public.trades enable row level security;
alter table public.positions enable row level security;
alter table public.ledger_entries enable row level security;

-- Profiles
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Invites: admins manage; users can see own invite row
create policy invites_select_own_or_admin on public.invites
  for select to authenticated
  using (email = public.current_email() or public.is_admin());

create policy invites_admin_insert on public.invites
  for insert to authenticated
  with check (public.is_admin());

create policy invites_admin_update on public.invites
  for update to authenticated
  using (public.is_admin());

-- Markets
create policy markets_select on public.markets
  for select to authenticated using (true);

create policy markets_insert on public.markets
  for insert to authenticated
  with check (created_by = auth.uid());

-- Orders
create policy orders_select on public.orders
  for select to authenticated using (true);

create policy orders_insert on public.orders
  for insert to authenticated
  with check (user_id = auth.uid());

-- Trades / positions / ledger
create policy trades_select on public.trades
  for select to authenticated using (true);

create policy positions_select on public.positions
  for select to authenticated using (true);

create policy ledger_select_own on public.ledger_entries
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- RPCs executable by authenticated
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.invites to authenticated;
grant select, insert on public.markets to authenticated;
grant select, insert on public.orders to authenticated;
grant select on public.trades to authenticated;
grant select on public.positions to authenticated;
grant select on public.ledger_entries to authenticated;

grant execute on function public.place_order to authenticated;
grant execute on function public.cancel_order to authenticated;
grant execute on function public.create_market_with_order to authenticated;
grant execute on function public.resolve_market to authenticated;
grant execute on function public.invite_email to authenticated;
grant execute on function public.count_confirmations to authenticated;
grant execute on function public.is_admin to authenticated;
