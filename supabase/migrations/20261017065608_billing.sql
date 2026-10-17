alter table public.royalt_shipments drop constraint if exists royalt_shipments_booking_status_check;
alter table public.royalt_shipments add constraint royalt_shipments_booking_status_check
  check(booking_status in ('new','confirmed','pending_pickup','in_progress','completed','cancelled'));
create table public.royalt_business_settings (
  id integer primary key check(id=1),details jsonb not null default '{}',
  updated_at timestamptz not null default clock_timestamp(),updated_by uuid references auth.users(id)
);
insert into public.royalt_business_settings(id) values(1);
create table public.royalt_invoice_counters (
  financial_year text not null,prefix text not null,last_number integer not null check(last_number between 1 and 99999),
  primary key(financial_year,prefix)
);
create table public.royalt_invoices (
  id uuid primary key default gen_random_uuid(),shipment_id uuid not null unique references public.royalt_shipments(id),
  invoice_number varchar(16) not null unique,financial_year text not null,issued_date date not null,
  buyer_name text not null,booking_reference text not null,total_paise bigint not null check(total_paise>0),
  snapshot jsonb not null,issued_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index royalt_invoices_date on public.royalt_invoices(issued_date desc);
alter table public.royalt_business_settings enable row level security;
alter table public.royalt_invoice_counters enable row level security;
alter table public.royalt_invoices enable row level security;
revoke all on public.royalt_business_settings,public.royalt_invoice_counters,public.royalt_invoices from public,anon,authenticated,service_role;
grant select,update on public.royalt_business_settings to service_role;
grant select on public.royalt_invoices to service_role;
create function public.royalt_issue_invoice(p_shipment uuid,p_record_updated timestamptz,p_settings_updated timestamptz,p_snapshot jsonb,p_staff uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.royalt_shipments; b public.royalt_business_settings; inv public.royalt_invoices;
  today date:=(now() at time zone 'Asia/Kolkata')::date; y integer; fy text; v_prefix text; seq integer; number text;
begin
  if not exists(select 1 from public.royalt_staff_profiles where id=p_staff and active) then raise exception 'Active staff required'; end if;
  select * into s from public.royalt_shipments where id=p_shipment for update;
  if not found then raise exception 'Booking missing'; end if;
  select * into inv from public.royalt_invoices where shipment_id=p_shipment;
  if found then return to_jsonb(inv); end if;
  if s.booking_status not in ('confirmed','in_progress','completed') then raise exception 'Confirm booking first'; end if;
  select * into b from public.royalt_business_settings where id=1 for share;
  if s.updated_at is distinct from p_record_updated or b.updated_at is distinct from p_settings_updated
    or p_snapshot->'seller' is distinct from b.details then raise exception 'Billing details changed' using errcode='40001'; end if;
  v_prefix:=b.details->>'invoicePrefix';
  if v_prefix is null or v_prefix!~'^[A-Z0-9]{1,4}$' or jsonb_typeof(p_snapshot->'items')!='array'
    or jsonb_array_length(p_snapshot->'items') not between 1 and 25
    or (p_snapshot->'totals'->>'totalPaise')::bigint not between 1 and 10000000000 then raise exception 'Invalid invoice'; end if;
  y:=extract(year from today)::integer-case when extract(month from today)<4 then 1 else 0 end;
  fy:=y::text||'-'||right((y+1)::text,2);
  insert into public.royalt_invoice_counters(financial_year,prefix,last_number) values(fy,v_prefix,1)
    on conflict(financial_year,prefix) do update set last_number=public.royalt_invoice_counters.last_number+1 returning last_number into seq;
  number:=v_prefix||'/'||right(y::text,2)||'-'||right((y+1)::text,2)||'/'||lpad(seq::text,5,'0');
  insert into public.royalt_invoices(shipment_id,invoice_number,financial_year,issued_date,buyer_name,booking_reference,total_paise,snapshot,issued_by)
    values(s.id,number,fy,today,p_snapshot->'buyer'->>'name',s.reference,(p_snapshot->'totals'->>'totalPaise')::bigint,p_snapshot,p_staff) returning * into inv;
  insert into public.royalt_activity(shipment_id,actor,message) values(s.id,p_staff,'GST invoice '||number||' issued');
  return to_jsonb(inv);
end; $$;
revoke all on function public.royalt_issue_invoice(uuid,timestamptz,timestamptz,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.royalt_issue_invoice(uuid,timestamptz,timestamptz,jsonb,uuid) to service_role;
create function royalt_private.invoice_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Issued invoices cannot be edited or deleted. Use a credit/debit note for adjustments.'; end; $$;
create trigger royalt_invoice_immutable before update or delete on public.royalt_invoices for each row execute function royalt_private.invoice_immutable();
