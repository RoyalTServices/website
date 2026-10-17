# Royal T Supabase

**17 October 2026 status:** the database and both private Storage buckets are live, including rate-list and GST-billing migrations; `royalt-api` is deployed at version 7. The latest frontend is included in this release and ships through the existing GitHub/Vercel production workflow. GST billing is available through the invoice workflow described in [GST-BILLING.md](GST-BILLING.md). Automatic tracking still requires approved carrier credentials and scheduler activation. The current Supabase Cron setup and verification guide is [TRACKING-SETUP.md](TRACKING-SETUP.md); it supersedes the older external-scheduler suggestion below. No Supabase Cron job has been created yet.

Project: `vjnfefdfvneiqbkduezt` — RoyalT Courier Services, connected through the Royal T Services account. Its existing public business schema and Auth users were empty before setup. Both checked-in migrations are now applied. The `royalt-documents` private PDF bucket and `royalt-api` Edge Function are deployed.

The first administrator is `royaltservices360@gmail.com`. Its private activation link is stored outside Git; open it to set a password of at least 12 characters. No password was chosen on the user's behalf. The protected temporary setup and verification functions were closed and switched to gateway JWT verification after use.

## Existing Vercel website

Keep the existing `RoyalTServices/website` project, Framework Other, root `/`, Node 22, `npm ci`, `npm run build`, output `dist`. Public routes and the site's design are preserved. Its same-origin API function relays to Supabase and preserves HttpOnly Secure session cookies. `backend-config.mjs` contains only the public project URL and publishable key. Production does not need a privileged Supabase key in Vercel. Privileged credentials remain in the Supabase Edge runtime.

Only Vercel Production automatically selects this backend. Preview deployments require explicitly configured, separate backend variables and should retain Deployment Protection. For local development set `SUPABASE_EDGE_URL` and `SUPABASE_PUBLISHABLE_KEY` in an ignored `.env`; the template is `.env.example`. Direct Node hosting can instead use `SUPABASE_URL`, a publishable key and a server secret key. Legacy storage is available only with explicit local `LEGACY_BACKEND=true`; Vercel ignores it. `DATABASE_URL` and `STAFF_SETUP_KEY` are not the production runtime configuration.

`SITE_URL` remains `https://royaltservices.in` for SEO. After connecting the domain on 18 October 2026, the Edge runtime's default `APP_URL` is also `https://royaltservices.in` for staff links and scheduling. An explicitly configured `APP_URL` in Edge Function Secrets takes precedence and should use the same canonical domain. The Edge origin allowlist includes the existing Vercel host, `royaltservices.in` and `www.royaltservices.in`; update it for any additional legitimate origin.

After editing backend modules, run `npm run prepare:edge`, then deploy `royalt-api` with its `deno.json`. Generated dependency copies are ignored in Git. Gateway JWT verification is disabled for this function because public intake/tracking must be accessible. Its body implements verified staff Auth/session/profile checks, administrator roles, origin validation, rate limits and a separate cron bearer secret. Retain these checks. Supabase injects the privileged runtime credentials; never extract them into the browser, source code or logs.

## Data and access

The additive schema contains customers, courier partners, shipments, tracking events, enquiries, document metadata, payments, staff profiles, activity and sync runs. Every business table has RLS, and public business-table privileges are revoked. Staff roles come from active database profiles, not user-editable Auth metadata. RLS also checks that the current Auth session still exists.

`20261013194907_royal_t_backend.sql` adds the schema. `20261013203918_backend_security.sql` adds missing foreign-key indexes, improves the staff policy and revokes public execution of the pre-existing RLS event trigger without removing it. Both files were generated through Supabase CLI migration commands. Preserve their history; do not manually reapply them to the same project.

Public enquiry, quote, pickup, booking and assistant issue requests are stored in Enquiries. Pickup/booking requests also create an internal shipment reference. Retries keep one reference through an idempotency UUID. Staff can convert a quote into a booking, edit sender/receiver/package details, manage customers and billing fields, add manual tracking events and record charges/payments. Quote estimates are descriptive inputs, not trusted billing amounts. Payments are bookkeeping entries; they do not charge cards or issue GST invoices. No DHL/UPS purchase or carrier booking is triggered.

Administrators create one-time activation links under Staff access → Create invitation and share them privately with the invited staff member. This flow works without SMTP and does not send email. Staff activate their account and then sign in with email/password. Logout revokes the local session. Session tokens stay in HttpOnly, SameSite cookies and do not enter browser storage. Staff cannot change their own role or activate their own profile.

Disable public signups and anonymous sign-ins in the Supabase Auth dashboard as an additional account setting. The connector does not expose Auth configuration; the application's public registration/setup routes are disabled regardless, and an Auth user without an active staff profile cannot access business data. If adding emailed invitations later, configure SMTP and a token-hash invitation template before enabling delivery.

Security Advisors now report no database warnings. The remaining Auth advisory is leaked-password protection being disabled; Supabase documents that feature as Pro and above. The app enforces 12-character minimum activation passwords. Enable the account feature if using an eligible plan: [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Performance Advisors only report unused indexes on the new database; retain them until real traffic supports a decision.

## Private PDFs

`royalt-documents` is private, accepts PDFs only and limits uploads to 2 MB. Authenticated server routes check MIME, size and PDF signature. Public and ordinary staff direct uploads are not granted; server validation precedes privileged writes. Staff download URLs expire after 60 seconds. Metadata links each PDF to its shipment and uploader; failed metadata creation attempts to remove its new object.

Choose an approved retention period for customer data and documents and monitor database/Storage usage. No destructive automatic retention was applied to existing information.

## Tracking and scheduler

Public `/api/tracking?id=REFERENCE` reads cached rows and returns only reference, courier, status, timeline, location, estimated delivery and last update. Contacts, addresses, financial details and private notes are excluded. Random public references have 64 bits of entropy. Requests, login and tracking use database-backed rate limits with salted IP digests; intake also has a honeypot. These are baseline abuse controls. Through the Vercel relay, gateway connection IPs can aggregate multiple visitors; monitor rate-limit errors before launch and tune cautiously.

Set approved tracking credentials in Supabase Edge Function Secrets:

- `DHL_TRACKING_API_KEY` for DHL Unified Tracking.
- `UPS_CLIENT_ID` and `UPS_CLIENT_SECRET` for UPS OAuth; `UPS_ENVIRONMENT=sandbox` by default. Set production only for an approved live account.

No live credentials were supplied, so automatic provider tracking is not yet enabled. Mock adapters are test injections only. Carrier booking and label purchase deliberately reject until an approved shipping adapter exists; staff can upload labels from their carrier tool.

An administrator can open Staff access → Hourly tracking setup to copy the scheduler URL and Authorization header. The website URL is `https://royaltservices.in/api/cron/tracking` when using the default application URL. Never put its bearer token in the URL. For the recommended Supabase Cron setup, use the direct Supabase endpoint and Vault configuration in [TRACKING-SETUP.md](TRACKING-SETUP.md). No recurring scheduler has been activated yet.

The Edge runtime derives separate cron/rate-limit secrets from its privileged runtime credential using domain-separated HMAC, unless explicit `CRON_SECRET`/`RATE_LIMIT_SECRET` are configured. The cron secret is visible only to an authenticated administrator; raw privileged credentials are never returned. Rotating the underlying key changes derived secrets, so update the scheduler header afterward. Explicit secrets can instead be set in Supabase Edge Function Secrets.

The scheduler uses a database lock, handles at most 8 due active shipments within 45 seconds, normalizes and deduplicates events, backs off failures and stops polling delivered/cancelled shipments. DHL calls are at least five seconds apart. More than 8 shipments may need multiple runs; hourly scheduling does not guarantee an hourly update for every shipment. Request a production quota before raising throughput: DHL's documented initial allowance is 250 calls/day and one call per five seconds. The UI includes required DHL attribution. Incorporate DHL's tracking-data retention terms into the approved deletion procedure.

## Verification and legacy import

57 local tests passed using Node 22, covering PostgreSQL migrations/RLS, authorization, concurrency, deduplication, relay cookies/bodies, staff DOM flows and public build isolation. Live checks passed 32 API/Storage assertions: hosted login/logout, public intake retries, pickup/support requests, quote conversion, optimistic shipment edits, payments, unique tracking events, sanitized tracking, customer edit/history and PDF upload/signed download. The protected cron endpoint rejected the wrong token and accepted the administrator's token with no configured carrier. Temporary test users, business rows and PDFs were removed; the actual administrator remains. Real courier requests, expired PDF links and external hourly scheduling were not tested.

No pre-existing legacy records were imported or deleted. To import a private `data/internal-store.json`, back it up and run `node scripts/import-legacy.mjs` for a count-only dry run, then `node --env-file=.env scripts/import-legacy.mjs --apply` with direct server credentials configured privately. Existing metadata/history remains in `legacy_data`; source files are unchanged and retries are idempotent. Staff password hashes and sessions are not migrated. For a legacy `royalt_store` Postgres database, export its data value privately and set `INTERNAL_STORE_PATH`; never commit exports or keys. Old low-entropy references remain private and are replaced with random public references.

Vercel Hobby permits non-commercial personal use only; Royal T needs a commercially permitted plan such as Pro. No account plan was purchased or changed. Supabase Free can be used initially within its quotas, but an hourly job does not guarantee avoidance of inactivity pauses.

References: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [Edge secrets](https://supabase.com/docs/guides/functions/secrets), [Storage](https://supabase.com/docs/guides/storage/security/access-control), [DHL](https://developer.dhl.com/tracking), [UPS](https://github.com/UPS-API/api-documentation/blob/main/Tracking.yaml), [cron-job.org](https://docs.cron-job.org/rest-api.html), [Vercel Hobby](https://vercel.com/docs/plans/hobby).
