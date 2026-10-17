# Tracking storage and scheduled updates

Verified 17 October 2026 against the Royal T Supabase project `vjnfefdfvneiqbkduezt`.

## Current state

- The private shipment database stores the portal reference, selected courier, external tracking number, status, estimated delivery, last synchronization and next due time. Tracking events are stored separately and deduplicated. Public tracking reads the stored history rather than calling a courier on every page visit.
- Staff must create/save the shipment and enter its external tracking number. There is currently one external tracking number per shipment record. The portal does not discover bookings made in a carrier's separate website or import all their tracking numbers automatically.
- DHL and UPS API adapters and the protected scheduler endpoint are implemented. Their database integration statuses are currently `unconfigured`; live credentials and a successful real-shipment test remain pending. Self managed shipments accept saved tracking IDs and manual timeline updates, but have no automatic carrier adapter.
- There is no Supabase Cron job yet; `pg_cron` and `pg_net` were not installed at the time of this check. No tracking IDs are saved in the live project yet.

## Activate carrier access

1. Obtain approved tracking API access from the courier or the co-loader that owns the shipment account. A tracking number alone does not grant API access. Confirm the API can track the numbers used by this business.
2. In the Royal T project's **Edge Functions → Secrets**, set `DHL_TRACKING_API_KEY` for DHL. For UPS set `UPS_CLIENT_ID`, `UPS_CLIENT_SECRET`, and `UPS_ENVIRONMENT=production` for an approved live account. The default UPS environment is sandbox. Keep these credentials out of the frontend and repository.
3. In staff login, save a real shipment with the correct courier and external tracking number. Keep the booking active. Delivered/cancelled records are excluded from automatic polling.
4. Sign in as an administrator and open **Staff access → Hourly tracking setup**. Copy the **Authorization header** privately. It already includes `Bearer `. The label describes the original suggested schedule; the same endpoint also supports the schedule below. Do not use the Supabase service-role key as this header.

## Create the job inside Supabase

Supabase supports calling an Edge Function using Cron and `pg_net`, with the request credential stored in Vault: [official scheduling guide](https://supabase.com/docs/guides/functions/schedule-functions), [Cron dashboard guide](https://supabase.com/docs/guides/cron/quickstart).

1. Enable **Cron / pg_cron** in the Supabase project, and enable the **pg_net** extension. Use the dashboard's integration/extension controls.
2. In **Vault**, create a secret named `royalt_tracking_authorization`. Its value is the complete Authorization header copied from staff login. Vault and Edge Function Secrets are separate stores. The job below reads the credential from Vault at runtime.
3. Run this SQL in the project's SQL Editor. It creates or updates the named job. The request goes directly to Supabase, so it does not depend on the website host being available.

```sql
select cron.schedule(
  'royalt-tracking-refresh',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := 'https://vjnfefdfvneiqbkduezt.supabase.co/functions/v1/royalt-api/cron/tracking',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'royalt_tracking_authorization'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);
```

The job runs every 15 minutes, but a successfully updated shipment becomes due again only after one hour. This spreads the work: up to 8 due shipments per run, within a 45-second processing window. A backlog or provider errors can delay individual updates. An hourly scheduler alone can also miss the next due time and delay a shipment until the following run. Confirm carrier API allowances against the number of active shipments before enabling the schedule; a frequently active shipment can generate roughly 24 tracking calls per day. The current worker has retries/backoff and DHL request spacing, but no account-wide daily-quota counter.

## Verify it is actually updating

Open **Cron → job → History**, and check the HTTP response and the application sync log. A successful SQL scheduling run only means the HTTP request was queued; it does not prove the courier call succeeded.

```sql
-- Schedule state, without exposing the job's request credential.
select jobid, jobname, schedule, active
from cron.job where jobname = 'royalt-tracking-refresh';

-- HTTP outcome: expect 200 and processed > 0 with failed = 0 for a due test shipment.
select id, status_code, timed_out, error_msg, content
from net._http_response order by created desc limit 5;

-- Application outcome; errors contain shipment/provider identifiers, not credentials.
select * from public.royalt_sync_runs order by started_at desc limit 10;
```

Then reopen the shipment and its **Tracking history**. Confirm the last-sync time, current status and saved events. Test the portal's public reference on the tracking page. `processed: 0` can mean no due eligible shipments or no configured provider; it is not a successful carrier-integration test. A 401 response means the scheduler credential is missing or wrong. Provider failures require checking approved access, environment, tracking number and quotas.

To pause without deleting history:

```sql
select cron.alter_job(job_id := (
  select jobid from cron.job where jobname = 'royalt-tracking-refresh'
), active := false);
```

If the Edge cron secret or its underlying derived credential changes, replace the Vault value using the new administrator-only Authorization header. Do not create a second external scheduler for the same worker. Retention for customer records, tracking events, application/cron logs and PDFs still needs an agreed policy; the three-file rule applies only to rate workbooks.
