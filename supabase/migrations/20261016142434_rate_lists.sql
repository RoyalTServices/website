-- Excel price lists live only in private Storage. This singleton holds publication metadata.
insert into public.royalt_courier_partners(code,name) values('SELF','Self managed') on conflict do nothing;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('royalt-rate-lists','royalt-rate-lists',false,1500000,array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do nothing;
create table public.royalt_rate_state (
  id integer primary key check(id=1), active_path text, updated_at timestamptz,
  updated_by uuid references auth.users(id), lock_token uuid, lock_until timestamptz
);
insert into public.royalt_rate_state(id) values(1);
alter table public.royalt_rate_state enable row level security;
revoke all on public.royalt_rate_state from anon,authenticated;
grant all on public.royalt_rate_state to service_role;
create function public.royalt_claim_rate_upload(p_token uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  update public.royalt_rate_state set lock_token=p_token,lock_until=now()+interval '120 seconds'
  where id=1 and (lock_until is null or lock_until<now());
  return found;
end; $$;
create function public.royalt_publish_rates(p_token uuid,p_path text,p_staff uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  update public.royalt_rate_state set active_path=p_path,updated_by=p_staff,updated_at=now()
  where id=1 and lock_token=p_token and lock_until>now();
  if not found then raise exception 'Upload lock expired'; end if;
  return true;
end; $$;
create function public.royalt_release_rate_upload(p_token uuid) returns void
language sql security definer set search_path='' as $$
  update public.royalt_rate_state set lock_token=null,lock_until=null where id=1 and lock_token=p_token;
$$;
revoke all on function public.royalt_claim_rate_upload(uuid),public.royalt_publish_rates(uuid,text,uuid),public.royalt_release_rate_upload(uuid) from public,anon,authenticated;
grant execute on function public.royalt_claim_rate_upload(uuid),public.royalt_publish_rates(uuid,text,uuid),public.royalt_release_rate_upload(uuid) to service_role;
