-- Allow anonymous invite pre-check before magic link is sent
create or replace function public.check_invite(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := lower(trim(p_email));
begin
  return exists (select 1 from public.invites where email = cleaned);
end;
$$;

grant execute on function public.check_invite(text) to anon, authenticated;
