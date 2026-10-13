-- Restrict the pre-existing Supabase event trigger, without removing the trigger.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
create index if not exists royalt_activity_actor on public.royalt_activity(actor);
create index if not exists royalt_activity_enquiry on public.royalt_activity(enquiry_id);
create index if not exists royalt_documents_uploader on public.royalt_documents(uploaded_by);
create index if not exists royalt_enquiry_shipment on public.royalt_enquiries(shipment_id);
create index if not exists royalt_payment_creator on public.royalt_payments(created_by);
create index if not exists royalt_event_partner on public.royalt_tracking_events(courier_partner);
alter policy royalt_profiles_read on public.royalt_staff_profiles
  using (id=(select auth.uid()) or (select royalt_private.is_staff('admin')));
-- These tables are intentionally available only to the server's service role.
create policy server_only on royalt_private.rate_limits for all to service_role using(true) with check(true);
create policy server_only on royalt_private.sync_lock for all to service_role using(true) with check(true);
