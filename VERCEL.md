# Vercel deployment

Use the existing `RoyalTServices/website` Vercel project. Select the standalone root Node application (`app`, directory `/`), set Framework Preset to **Other**, and keep the root directory at `/`. Do not import the Python maintenance scripts as an application or choose Services mode.

The checked-in configuration sets `npm ci`, `npm run build`, the `dist` output, Node 22, a Mumbai function region and a 60-second API limit. It builds 21 complete public HTML pages and a real 404 page. Browser JavaScript adds the interactive forms, calculator and assistant. `/api/*` routes share the existing Node function.

Supabase is the primary production backend. The schema, private PDF bucket, secure Edge backend and first administrator are configured. Production's existing API relays to that backend using only the public project key; no privileged Vercel key is required. See [SUPABASE.md](SUPABASE.md) for staff activation, local/preview environments and remaining scheduler/provider setup. Keep privileged credentials in Supabase Edge Function Secrets.

Public pages render independently of a database, but requests, staff operations and tracking require the hosted Supabase backend. Missing configuration or failed writes produce an error; an unsaved request never receives a false confirmation. Customer records, local exports, credentials, server source and test scripts are excluded from `dist`.

`APP_URL` is the existing deployed origin, currently `https://website-plum-tau-44.vercel.app`. Keep the current domain and routes. If connecting `royaltservices.in`, use the domain/DNS settings Vercel supplies rather than creating a second project. `SITE_URL` controls production SEO metadata. Preview builds always remain noindex and use disallowing robots rules. Use isolated preview Supabase credentials and Vercel Deployment Protection.

The external hourly tracking job, credentials and verification steps are in SUPABASE.md. Vercel Hobby permits non-commercial personal use only; use a plan permitting Royal T's business deployment, such as Pro. No account plan has been changed or purchased.

## If import shows “Import multi-service project”

Return to application selection and choose the **standalone root app**. Set Framework Preset to **Other**, not **Services**. The current configuration is deliberately a single website with its API function. A Services project instead requires a `services` block. Existing projects accidentally set to Services should be changed to Other in Build and Deployment settings, with Root Directory at `/`.

Python dependencies live in `scripts/python-requirements.txt`, avoiding the application detection hint `requirements.txt`. These offline maintenance tools are excluded from Vercel uploads. Install them locally only when needed with `python -m pip install -r scripts/python-requirements.txt`.

References: [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [Node functions](https://vercel.com/docs/functions/runtimes/node-js), [Hobby terms](https://vercel.com/docs/plans/hobby).
