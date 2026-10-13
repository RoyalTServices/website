# Search and local business launch setup

Configured domain: **https://royaltservices.in**. Confirmed priority customer markets: **Hyderabad and Telangana**. Phone/WhatsApp: **+91 90001 59988**. Titles, descriptions, home copy, service-page context and shipping questions target affordable courier options, low-cost shipping enquiries, sending parcels abroad, domestic parcel delivery and efficient shipment preparation. These are relevance improvements, not search-volume research or a guarantee of rankings.

The domain is configured for production canonicals, sitemap and robots generation. This does not deploy the site or submit it to Google. After publishing the updated server on that domain, submit **https://royaltservices.in/sitemap.xml** through Search Console. The physical office address remains unconfirmed, so the schema identifies an Organization serving the stated markets rather than inventing a LocalBusiness address or map coordinates.

The website delivers real page text, links, headings and metadata in its initial HTML. The Vercel build pre-renders each public route; the local Node preview renders the same pages on request. Browser JavaScript adds interactive quotes, tracking, forms and chat to that content. Both use `pages.js`, with no separate hidden SEO copy. See [VERCEL.md](VERCEL.md) for deployment settings. Vercel Preview builds automatically remain unindexed.

## Required before indexing the public site

1. Set `config.seo.siteUrl` in `site-config.js` to the final public **HTTPS origin**, for example your actual domain without a path. Alternatively set the server's `SITE_URL` environment variable. No domain has been guessed. Without an origin, previews deliberately return `noindex` and an all-disallow robots file, and `/sitemap.xml` reports that configuration is required. These are launch safeguards, not live indexing settings.
2. Keep `indexingEnabled: true` for the public production site. Keep staging protected and unindexed; use a separate preview configuration with indexing disabled. An origin alone is not proof that a deployment is publicly reachable.
3. Supply the confirmed city/locality, public street address, region and PIN code. Add the support email and business hours. The phone and WhatsApp values now use the supplied **+91 90001 59988**.
4. Set `localBusinessVerified: true` only after the location details are confirmed. The website will then show the city in home copy/title, show the address on Contact, and produce LocalBusiness structured data. Until then it emits honest Organization data rather than invented coordinates or an incomplete local address. Populate `openingHoursSpecification` with actual days/times, and keep the visible `config.hours` consistent.
5. Complete and approve the policy details separately. Draft policies are accessible through the footer but remain `noindex,follow` and absent from the sitemap until `legal.status` changes from `draft` to `published`.

Deploy using the checked-in Vercel configuration, or run the Node server behind another production HTTPS host. The Vercel build generates individual complete HTML pages rather than a static index.html fallback. Test a direct request to a service URL after deployment; its HTML must contain the service H1 and content before JavaScript runs.

## Google Business Profile and Search Console

- Create/verify the business profile under the genuine customer-facing business name. Use an accurate category, address or service-area setup, real number, business hours and website URL. Do not add marketing keywords to the business name or invent branches.
- Use the same name, address and phone on the profile and website. A service-area business should follow Google's address-visibility guidance instead of publishing a private/non-customer-facing address purely for SEO. Review the schema/address setup for that model before enabling LocalBusiness.
- Add the six actual service categories, suitable photos and a description of domestic/international courier, documents/parcels, imports, air freight and surface cargo. Dangerous goods acceptance remains subject to assessment.
- Once the profile URL is available, add it to `config.seo.googleBusinessUrl`; real social profiles can be placed in `sameAs`.
- Verify the domain in Google Search Console. DNS verification works independently of this code; for HTML verification, set `searchConsoleVerification` to the supplied verification token.
- Submit `https://YOUR-ACTUAL-DOMAIN/sitemap.xml`, then use URL Inspection on Home and the six service pages. Check canonical selection, indexability, rendered HTML and mobile usability. Request indexing for important new pages after verification; a sitemap does not guarantee inclusion.
- Use Rich Results Test to review applicable structured data, and PageSpeed Insights to check the deployed site's performance. Organisation, service and breadcrumb markup describe actual content; there are no fabricated reviews or ratings, numeric price offers, or courier FAQ-rich-result promises.
- Monitor indexed pages and search queries. Add useful content from genuine customer questions and actual service areas. Do not generate cloned city pages, hidden keywords or thin destination pages merely to target search terms.

## Implemented search foundations

- Unique intent-based titles and descriptions on all 21 public routes; service text available without running JavaScript.
- Canonical URLs, Open Graph/social metadata and JSON-LD from the configured origin, not the request Host header. Query parameters do not become separate canonical shipment pages.
- Search phrases used naturally: international courier from India, domestic document and parcel delivery, DHL/UPS courier options, courier pickup, air freight, imports express, surface cargo and dangerous goods export enquiries.
- A real service index with crawlable links to six detailed service pages; visible shipping questions on Home and service breadcrumbs.
- Correct 404 responses, trailing-slash redirects and a single canonical URL format. Unknown service URLs do not return an indexable success page.
- Automatic sitemap with only eligible public pages. Tracking pages, draft policies and staff/API records are excluded. Staff pages/API responses carry explicit noindex headers; staff access is separately controlled by authentication, not robots rules.
- Server and browser share page rendering; client navigation updates titles, descriptions, canonicals and structured data.
- Gzip compression for eligible HTML/CSS/JavaScript/JSON/SVG, lazy service photos, explicit image dimensions and priority loading for the home illustration. Fonts retain their existing swap behaviour.

## Verification

`node --test scripts/seo.test.mjs` checks metadata uniqueness, H1s, sitemap filtering, preview protection, honest schema, injection escaping and HTTP rendering/status/headers/compression. `npm test` includes these plus pricing, assistant and staff API regressions. `npm run check` covers new and existing JavaScript modules.

These checks verify the implementation. Live Google indexing, search position, local results and real-user performance require the actual domain, confirmed location, public deployment and subsequent monitoring.

## Official guidance

- [Google: JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics): serving renderable content, canonical signals and avoiding soft 404s.
- [Google: Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap): supply canonical URLs and submit through Search Console; sitemap submission is a discovery signal.
- [Google: Local business structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business): supply real business details and applicable required properties.
- [Google: Improve local ranking](https://support.google.com/business/answer/7091): accurate, complete business information; local relevance, distance and prominence influence results.
- [Google: Represent your business accurately](https://support.google.com/business/answer/3038177): genuine names, addresses, categories and service-area business rules.
