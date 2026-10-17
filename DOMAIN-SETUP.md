# Royal T domain connection and privacy checks

Connected on 18 October 2026. Registrar and DNS hosting remain with GoDaddy. The existing `website` project in the Royal T Services Vercel team serves production.

| Type | GoDaddy name | Value |
| --- | --- | --- |
| A | @ | 216.198.79.1 |
| CNAME | www | 155506b69750b4b0.vercel-dns-017.com |

These are the exact targets displayed by this Vercel project, not generic example records. The former parked A record and www-to-apex CNAME were edited. Existing nameservers, SOA, `_domainconnect` and DMARC records were preserved. Vercel reports **Valid Configuration** for both domains. `www.royaltservices.in` has a 308 permanent redirect to `https://royaltservices.in`.

The Edge Function's default application URL is now `https://royaltservices.in`, matching the site's existing canonical URL. A separately configured `APP_URL` environment value takes precedence. Both custom-domain origins were already allowed by the authenticated backend.

## Verification

Strict HTTPS requests to Vercel's assigned IP, using the custom hostname and normal certificate verification, confirmed:

- `https://royaltservices.in/`: 200 and Royal T site content.
- `https://www.royaltservices.in/`: 308 to the canonical main domain.
- `/api/rates`: 200, with rates valid until replaced.
- `/api/internal/invoices`: 401 without a staff login.

Some recursive DNS caches still returned the previous parked values immediately after the change. DNS propagation is separate from Vercel's valid assignment and HTTPS readiness. Once caches refresh, repeat the same checks through normal DNS. GoDaddy's save confirmation states updates usually take effect within an hour and may take up to 48 hours globally.

## Confidentiality review

The check scanned 98 tracked text/source files and additions across all 9 commits available in local Git history at the start of the review. No actual privileged keys or private customer files were identified. The only credential-pattern match was the intentionally invalid `user:password@example.com` URL in a URL-rejection test. This is a scoped source/history and access review, not a guarantee that every possible vulnerability is absent.

- Environment files, local customer records, administrator activation links and the signature image were not found in tracked history and are excluded by Git/deployment rules.
- Live requests for `.env`, `.git` files, local customer data, the activation-link file, the signature image, server modules and backend documentation returned 404.
- Staff records, customers, business settings, invoices and scheduler credentials returned 401 to signed-out requests. The session endpoint returns a null user.
- All 16 application/private tables checked have RLS enabled. Public business tables have no anonymous/PUBLIC table grants. Both Storage buckets are private; anonymous listing returned no objects, including in the populated rate bucket.
- Project identifiers and the Supabase publishable key are public configuration, not privileged credentials. Public selling prices, quote data and the predefined rate workbook are intentionally accessible. Browser JavaScript and styles are public assets.

Keeping the repository private is separate from website access control. Customer records, private files and privileged credentials must stay out of Git even when the repository is private. Detailed raw check outputs and the pre-change DNS values remain in the ignored `.internal-test` directory.
