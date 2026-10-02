-- Wallet modes: free (play money) vs linked (Cash App / Robinhood connected)
-- Balances remain in-app ledger credits — connections do not move real money.

alter table public.profiles
  add column if not exists wallet_mode text not null default 'free'
    check (wallet_mode in ('free', 'linked'));

create table if not exists public.payment_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('cashapp', 'robinhood')),
  handle text not null,
  status text not null default 'connected'
    check (status in ('connected', 'disconnected')),
  display_name text,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  unique (user_id, provider)
);

create index if not exists payment_connections_user_idx
  on public.payment_connections (user_id);

alter table public.payment_connections enable row level security;

create policy payment_connections_select_own on public.payment_connections
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy payment_connections_insert_own on public.payment_connections
  for insert to authenticated
  with check (user_id = auth.uid());

create policy payment_connections_update_own on public.payment_connections
  for update to authenticated
  using (user_id = auth.uid());

grant select, insert, update on public.payment_connections to authenticated;

create or replace function public.has_active_connection(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.payment_connections
    where user_id = p_user and status = 'connected'
  );
$$;

grant execute on function public.has_active_connection(uuid) to authenticated;

create or replace function public.set_wallet_mode(p_mode text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  p public.profiles;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_mode not in ('free', 'linked') then
    raise exception 'Mode must be free or linked';
  end if;
  if p_mode = 'linked' and not public.has_active_connection(v_user) then
    raise exception 'Connect Cash App or Robinhood before switching to linked mode';
  end if;

  update public.profiles
  set wallet_mode = p_mode
  where id = v_user
  returning * into p;

  return p;
end;
$$;

grant execute on function public.set_wallet_mode(text) to authenticated;

create or replace function public.connect_payment(
  p_provider text,
  p_handle text,
  p_display_name text default null
)
returns public.payment_connections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  cleaned text;
  conn public.payment_connections;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_provider not in ('cashapp', 'robinhood') then
    raise exception 'Provider must be cashapp or robinhood';
  end if;

  cleaned := trim(p_handle);
  if p_provider = 'cashapp' then
    cleaned := regexp_replace(cleaned, '^\$+', '');
    cleaned := lower(cleaned);
    if cleaned !~ '^[a-z][a-z0-9_]{1,19}$' then
      raise exception 'Enter a valid Cash App cashtag (letters, numbers, underscore)';
    end if;
    cleaned := '$' || cleaned;
  else
    -- Robinhood username / email-style handle
    cleaned := lower(cleaned);
    if length(cleaned) < 3 or length(cleaned) > 64 then
      raise exception 'Enter a valid Robinhood username or email';
    end if;
    if cleaned !~ '^[a-z0-9._@+-]+$' then
      raise exception 'Robinhood handle has invalid characters';
    end if;
  end if;

  insert into public.payment_connections (
    user_id, provider, handle, display_name, status, connected_at, disconnected_at
  ) values (
    v_user,
    p_provider,
    cleaned,
    nullif(trim(coalesce(p_display_name, '')), ''),
    'connected',
    now(),
    null
  )
  on conflict (user_id, provider) do update
  set
    handle = excluded.handle,
    display_name = excluded.display_name,
    status = 'connected',
    connected_at = now(),
    disconnected_at = null
  returning * into conn;

  return conn;
end;
$$;

grant execute on function public.connect_payment(text, text, text) to authenticated;

create or replace function public.disconnect_payment(p_provider text)
returns public.payment_connections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  conn public.payment_connections;
  remaining int;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_provider not in ('cashapp', 'robinhood') then
    raise exception 'Invalid provider';
  end if;

  update public.payment_connections
  set status = 'disconnected', disconnected_at = now()
  where user_id = v_user and provider = p_provider
  returning * into conn;

  if not found then
    raise exception 'Connection not found';
  end if;

  select count(*) into remaining
  from public.payment_connections
  where user_id = v_user and status = 'connected';

  -- Auto-fall back to free mode if last link removed
  if remaining = 0 then
    update public.profiles
    set wallet_mode = 'free'
    where id = v_user and wallet_mode = 'linked';
  end if;

  return conn;
end;
$$;

grant execute on function public.disconnect_payment(text) to authenticated;

-- Require an active connection when profile is in linked mode
create or replace function public.require_wallet_ready()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mode text;
begin
  select wallet_mode into mode from public.profiles where id = auth.uid();
  if mode = 'linked' and not public.has_active_connection(auth.uid()) then
    raise exception 'Linked mode requires a Cash App or Robinhood connection';
  end if;
end;
$$;

-- Patch place_order / create_market to enforce wallet readiness
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

  perform public.require_wallet_ready();

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
      no_price := maker.price_cents;
      yes_price := 100 - no_price;
      yes_oid := v_order.id;
      no_oid := maker.id;
      yes_uid := v_user;
      no_uid := maker.user_id;
    else
      yes_price := maker.price_cents;
      no_price := 100 - yes_price;
      yes_oid := maker.id;
      no_oid := v_order.id;
      yes_uid := maker.user_id;
      no_uid := v_user;
    end if;

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

  perform public.maybe_go_live(p_market_id);

  return jsonb_build_object(
    'order', row_to_json(v_order),
    'fills', fills,
    'confirmations', public.count_confirmations(p_market_id),
    'market_status', (select status from public.markets where id = p_market_id)
  );
end;
$$;
