-- Additive Royal T schema. No existing tables or records are removed.
create schema if not exists royalt_private;
revoke all on schema royalt_private from public, anon;
grant usage on schema royalt_private to authenticated, service_role;

create table if not exists public.royalt_staff_profiles (
  id uuid primary key references auth.users(id), email text not null,
  display_name text not null default '', role text not null check(role in ('admin','staff')),
  active boolean not null default true, created_at timestamptz not null default now()
);
create or replace function royalt_private.is_staff(required_role text default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.royalt_staff_profiles p
    where p.id=auth.uid() and p.active and (required_role is null or p.role=required_role)
  ) and exists (
    select 1 from auth.sessions s where s.user_id=auth.uid()
    and s.id::text=auth.jwt()->>'session_id'
  );
$$;
revoke all on function royalt_private.is_staff(text) from public, anon;
grant execute on function royalt_private.is_staff(text) to authenticated;
create or replace function public.royalt_staff_access() returns boolean language sql stable security invoker set search_path='' as $$ select royalt_private.is_staff(); $$;
revoke all on function public.royalt_staff_access() from public,anon;
grant execute on function public.royalt_staff_access() to authenticated;

create table if not exists public.royalt_customers (
  id uuid primary key default gen_random_uuid(), name text not null,
  email text not null default '', phone text not null default '', company text not null default '',
  billing_address jsonb not null default '{}', gstin text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists royalt_customer_email on public.royalt_customers(lower(email));
create index if not exists royalt_customer_phone on public.royalt_customers(phone);

create table if not exists public.royalt_courier_partners (
  code text primary key, name text not null, partner_identifier text not null default '',
  integration_status text not null default 'unconfigured' check(integration_status in ('unconfigured','configured','disabled')),
  created_at timestamptz not null default now()
);
insert into public.royalt_courier_partners(code,name) values ('DHL','DHL'),('UPS','UPS') on conflict do nothing;

create table if not exists public.royalt_shipments (
  id uuid primary key default gen_random_uuid(), reference text not null unique,
  customer_id uuid not null references public.royalt_customers(id),
  courier_partner text references public.royalt_courier_partners(code), external_tracking_number text not null default '',
  request_type text not null default 'shipment' check(request_type in ('shipment','booking','pickup')),
  service text not null default '', sender jsonb not null default '{}', receiver jsonb not null default '{}',
  origin text not null default '', destination text not null default '', from_pin text not null default '', to_pin text not null default '',
  package_description text not null default '', shipment_kind text not null default '',
  weight numeric(12,3) check(weight>0), dimensions jsonb not null default '{}', packages integer check(packages>0),
  declared_value numeric(14,2) check(declared_value>=0),
  booking_status text not null default 'new' check(booking_status in ('new','pending_pickup','in_progress','completed','cancelled')),
  tracking_status text not null default 'pending' check(tracking_status in ('pending','in_transit','delivered','exception','cancelled','unknown')),
  shipping_cost numeric(14,2) not null default 0 check(shipping_cost>=0), selling_price numeric(14,2) not null default 0 check(selling_price>=0),
  currency text not null default 'INR' check(currency~'^[A-Z]{3}$'), pickup_date date,
  booked_at timestamptz not null default now(), estimated_delivery date, delivered_at timestamptz,
  last_tracking_sync timestamptz, next_tracking_sync timestamptz not null default now(), sync_failures integer not null default 0,
  staff_notes text not null default '', legacy_data jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists royalt_shipment_customer on public.royalt_shipments(customer_id,created_at desc);
create index if not exists royalt_shipment_status on public.royalt_shipments(booking_status,created_at desc);
create index if not exists royalt_shipment_sync on public.royalt_shipments(next_tracking_sync) where tracking_status not in ('delivered','cancelled');
create index if not exists royalt_shipment_tracking on public.royalt_shipments(courier_partner,external_tracking_number);

create table if not exists public.royalt_tracking_events (
  id uuid primary key default gen_random_uuid(), shipment_id uuid not null references public.royalt_shipments(id),
  courier_partner text references public.royalt_courier_partners(code), event_key text not null,
  partner_event_id text not null default '', status text not null, description text not null default '', location text not null default '',
  event_at timestamptz, local_timestamp text not null default '', created_at timestamptz not null default now(),
  unique(shipment_id,event_key)
);
create index if not exists royalt_events_timeline on public.royalt_tracking_events(shipment_id,event_at desc);
create table if not exists public.royalt_enquiries (
  id uuid primary key default gen_random_uuid(), reference text not null unique,
  customer_id uuid not null references public.royalt_customers(id), shipment_id uuid references public.royalt_shipments(id),
  type text not null check(type in ('enquiry','quotation','pickup','booking','assistant_issue')),
  payload jsonb not null default '{}', status text not null default 'new' check(status in ('new','reviewing','resolved','closed')),
  staff_notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  idempotency_key uuid unique
);
create index if not exists royalt_enquiry_status on public.royalt_enquiries(status,created_at desc);
create index if not exists royalt_enquiry_customer on public.royalt_enquiries(customer_id);
create table if not exists public.royalt_documents (
  id uuid primary key default gen_random_uuid(), shipment_id uuid not null references public.royalt_shipments(id),
  object_path text not null unique, file_name text not null, content_type text not null check(content_type='application/pdf'),
  size_bytes integer not null check(size_bytes between 1 and 2097152),
  kind text not null check(kind in ('label','invoice','pickup','pod','other')), uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists royalt_document_shipment on public.royalt_documents(shipment_id);
create table if not exists public.royalt_payments (
  id uuid primary key default gen_random_uuid(), shipment_id uuid not null references public.royalt_shipments(id),
  amount numeric(14,2) not null check(amount>0), currency text not null default 'INR' check(currency~'^[A-Z]{3}$'),
  method text not null, transaction_reference text not null default '', status text not null default 'paid' check(status in ('pending','paid','refunded')),
  paid_at timestamptz not null default now(), created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  idempotency_key uuid unique
);
create index if not exists royalt_payment_shipment on public.royalt_payments(shipment_id);
create table if not exists public.royalt_activity (
  id uuid primary key default gen_random_uuid(), shipment_id uuid references public.royalt_shipments(id),
  enquiry_id uuid references public.royalt_enquiries(id), message text not null, actor uuid references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists royalt_activity_shipment on public.royalt_activity(shipment_id,created_at desc);
create table if not exists public.royalt_sync_runs (
  id uuid primary key default gen_random_uuid(), started_at timestamptz not null default now(), finished_at timestamptz,
  processed integer not null default 0, failed integer not null default 0, errors jsonb not null default '[]'
);
create table if not exists royalt_private.rate_limits (
  key text primary key, hits integer not null, expires_at timestamptz not null
);
create table if not exists royalt_private.sync_lock (id integer primary key check(id=1), expires_at timestamptz not null);
alter table royalt_private.rate_limits enable row level security;
alter table royalt_private.sync_lock enable row level security;
grant all on all tables in schema royalt_private to service_role;

do $$ declare t text; begin
  foreach t in array array['royalt_staff_profiles','royalt_customers','royalt_courier_partners','royalt_shipments','royalt_tracking_events','royalt_enquiries','royalt_documents','royalt_payments','royalt_activity','royalt_sync_runs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    if t='royalt_staff_profiles' then
      execute 'create policy royalt_profiles_read on public.royalt_staff_profiles for select to authenticated using (id=auth.uid() or royalt_private.is_staff(''admin''))';
    else
      execute format('create policy royalt_staff_read on public.%I for select to authenticated using (royalt_private.is_staff())',t);
      if t not in ('royalt_sync_runs','royalt_courier_partners') then
        execute format('grant insert, update on public.%I to authenticated',t);
        execute format('create policy royalt_staff_insert on public.%I for insert to authenticated with check (royalt_private.is_staff())',t);
        execute format('create policy royalt_staff_update on public.%I for update to authenticated using (royalt_private.is_staff()) with check (royalt_private.is_staff())',t);
      end if;
    end if;
  end loop;
end $$;

create or replace function public.royalt_rate_limit(p_key text,p_limit integer,p_window integer) returns boolean
language plpgsql security invoker set search_path='' as $$ declare n integer; begin
  insert into royalt_private.rate_limits(key,hits,expires_at) values(p_key,1,now()+make_interval(secs=>p_window))
  on conflict(key) do update set hits=case when royalt_private.rate_limits.expires_at<now() then 1 else royalt_private.rate_limits.hits+1 end,
    expires_at=case when royalt_private.rate_limits.expires_at<now() then now()+make_interval(secs=>p_window) else royalt_private.rate_limits.expires_at end returning hits into n;
  return n<=p_limit;
end $$;
revoke all on function public.royalt_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.royalt_rate_limit(text,integer,integer) to service_role;

create or replace function public.royalt_submit_request(p_customer jsonb,p_payload jsonb,p_reference text,p_key uuid) returns text
language plpgsql security invoker set search_path='' as $$ declare c uuid;s uuid;e text; begin
  -- A retry with the same request key returns its original reference atomically.
  perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
  select reference into e from public.royalt_enquiries where idempotency_key=p_key;
  if e is not null then return e;end if;
  insert into public.royalt_customers(name,email,phone,company,billing_address,gstin)
    values(p_customer->>'name',coalesce(p_customer->>'email',''),coalesce(p_customer->>'phone',''),coalesce(p_customer->>'company',''),coalesce(p_customer->'billingAddress','{}'),coalesce(p_customer->>'gstin','')) returning id into c;
  if p_payload->>'type' in ('booking','pickup') then
    insert into public.royalt_shipments(reference,customer_id,request_type,service,sender,receiver,origin,destination,from_pin,to_pin,package_description,shipment_kind,weight,packages,dimensions,declared_value,pickup_date,booking_status,legacy_data)
      values(p_reference,c,p_payload->>'type',coalesce(p_payload->>'service',''),jsonb_build_object('name',p_customer->>'name','address',p_payload->>'address'),coalesce(p_payload->'receiver','{}'),coalesce(p_payload->>'origin','India'),coalesce(p_payload->>'destination',''),coalesce(p_payload->>'fromPin',''),coalesce(p_payload->>'toPin',''),coalesce(p_payload->>'message',p_payload->>'contents',''),coalesce(p_payload->>'kind',''),nullif(p_payload->>'weight','')::numeric,nullif(p_payload->>'boxes','')::integer,coalesce(p_payload->'dimensions','{}'),nullif(p_payload->>'declaredValue','')::numeric,nullif(p_payload->>'date','')::date,case when p_payload->>'type'='pickup' then 'pending_pickup' else 'new' end,p_payload) returning id into s;
  end if;
  insert into public.royalt_enquiries(reference,customer_id,shipment_id,type,payload,idempotency_key) values(p_reference,c,s,p_payload->>'type',p_payload,p_key);
  return p_reference;
end $$;
revoke all on function public.royalt_submit_request(jsonb,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.royalt_submit_request(jsonb,jsonb,text,uuid) to service_role;

create or replace function public.royalt_claim_sync() returns boolean language plpgsql security invoker set search_path='' as $$ declare claimed integer;begin
  insert into royalt_private.sync_lock(id,expires_at) values(1,now()+interval '90 seconds')
    on conflict(id) do update set expires_at=excluded.expires_at where royalt_private.sync_lock.expires_at<now() returning id into claimed;
  return claimed is not null;
end $$;
revoke all on function public.royalt_claim_sync() from public,anon,authenticated;
grant execute on function public.royalt_claim_sync() to service_role;

create or replace function public.royalt_release_sync() returns void language sql security invoker set search_path='' as $$ update royalt_private.sync_lock set expires_at=now() where id=1; $$;
revoke all on function public.royalt_release_sync() from public,anon,authenticated;
grant execute on function public.royalt_release_sync() to service_role;

create or replace function public.royalt_apply_tracking(p_id uuid,p_status text,p_estimated date,p_delivered timestamptz,p_events jsonb) returns void
language plpgsql security invoker set search_path='' as $$ begin
  insert into public.royalt_tracking_events(shipment_id,courier_partner,event_key,partner_event_id,status,description,location,event_at,local_timestamp)
    select p_id,e->>'partner',e->>'key',coalesce(e->>'id',''),e->>'status',coalesce(e->>'description',''),coalesce(e->>'location',''),nullif(e->>'timestamp','')::timestamptz,coalesce(e->>'localTimestamp','') from jsonb_array_elements(p_events) e
    on conflict(shipment_id,event_key) do nothing;
  update public.royalt_shipments set tracking_status=p_status,
    booking_status=case when p_status='delivered' then 'completed' when p_status='cancelled' then 'cancelled' else booking_status end,
    estimated_delivery=coalesce(p_estimated,estimated_delivery),delivered_at=coalesce(p_delivered,delivered_at),
    last_tracking_sync=now(),next_tracking_sync=now()+interval '1 hour',sync_failures=0,updated_at=now()
    where id=p_id;
end $$;
revoke all on function public.royalt_apply_tracking(uuid,text,date,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.royalt_apply_tracking(uuid,text,date,timestamptz,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('royalt-documents','royalt-documents',false,2097152,array['application/pdf']) on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['application/pdf'];
create policy royalt_storage_read on storage.objects for select to authenticated using(bucket_id='royalt-documents' and royalt_private.is_staff());
-- Uploads pass through the authenticated server for PDF signature and size validation.
-- No public/authenticated INSERT policy: only the server's secret key can write objects.

create or replace function public.royalt_update_shipment(p_id uuid,p_expected timestamptz,p_patch jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$ declare old public.royalt_shipments;new public.royalt_shipments;patch jsonb;begin
  select * into old from public.royalt_shipments where id=p_id for update;
  if old.id is null or (p_expected is not null and old.updated_at<>p_expected) then return false;end if;
  select coalesce(jsonb_object_agg(key,value),'{}') into patch from jsonb_each(p_patch)
    where key=any(array['service','package_description','packages','booking_status','pickup_date','courier_partner','external_tracking_number','staff_notes','shipping_cost','selling_price','declared_value','weight','estimated_delivery','tracking_status','sender','receiver','dimensions','origin','destination','delivered_at','next_tracking_sync']);
  select * into new from jsonb_populate_record(null::public.royalt_shipments,to_jsonb(old)||patch);
  update public.royalt_shipments set service=new.service,package_description=new.package_description,packages=new.packages,booking_status=new.booking_status,pickup_date=new.pickup_date,courier_partner=new.courier_partner,external_tracking_number=new.external_tracking_number,staff_notes=new.staff_notes,shipping_cost=new.shipping_cost,selling_price=new.selling_price,declared_value=new.declared_value,weight=new.weight,estimated_delivery=new.estimated_delivery,tracking_status=new.tracking_status,sender=new.sender,receiver=new.receiver,dimensions=new.dimensions,origin=new.origin,destination=new.destination,delivered_at=new.delivered_at,next_tracking_sync=new.next_tracking_sync,updated_at=now() where id=p_id;
  insert into public.royalt_activity(shipment_id,message,actor) values(p_id,'Shipment details updated',auth.uid());return true;
end $$;
revoke all on function public.royalt_update_shipment(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.royalt_update_shipment(uuid,timestamptz,jsonb) to authenticated;

create or replace function public.royalt_convert_enquiry(p_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$ declare e public.royalt_enquiries;s uuid;p jsonb;begin
  select * into e from public.royalt_enquiries where id=p_id for update;
  if e.id is null then raise exception 'Enquiry unavailable';end if;
  if e.shipment_id is not null then return e.shipment_id;end if;
  if e.type not in ('enquiry','quotation') then raise exception 'This issue is not a shipment enquiry';end if;
  p=e.payload;
  insert into public.royalt_shipments(reference,customer_id,request_type,service,sender,receiver,origin,destination,from_pin,to_pin,package_description,shipment_kind,weight,packages,dimensions,declared_value,pickup_date,legacy_data)
    values(e.reference,e.customer_id,'booking',coalesce(p->>'service',''),jsonb_build_object('address',p->>'address'),coalesce(p->'receiver','{}'),coalesce(p->>'origin','India'),coalesce(p->>'destination',''),coalesce(p->>'fromPin',''),coalesce(p->>'toPin',''),coalesce(p->>'message',''),coalesce(p->>'kind',''),nullif(p->>'weight','')::numeric,nullif(p->>'boxes','')::integer,coalesce(p->'dimensions','{}'),nullif(p->>'declaredValue','')::numeric,nullif(p->>'date','')::date,p) returning id into s;
  update public.royalt_enquiries set shipment_id=s,status='reviewing',updated_at=now() where id=p_id;
  insert into public.royalt_activity(shipment_id,enquiry_id,message,actor) values(s,p_id,'Shipment request created from enquiry',auth.uid());return s;
end $$;
revoke all on function public.royalt_convert_enquiry(uuid) from public,anon;
grant execute on function public.royalt_convert_enquiry(uuid) to authenticated;
