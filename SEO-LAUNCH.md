# Google Search and local search setup

Production website: https://royaltservices.in
Sitemap: https://royaltservices.in/sitemap.xml
Business name: Royal T Courier Services
Legal name: Royal T Services Private Limited
Phone / WhatsApp: +91 95022 95222
Customer email: info@royaltservices.in
Priority customer markets: Andhra Pradesh and Telangana.

Royal T operates without a public walk-in office, as confirmed by the owner.
Keep the Google Business Profile address hidden and use the actual service areas.
Do not publish a private address or invent branches. Collection availability is
confirmed for each location; the website does not promise universal coverage.
The staff login email is separate from customer contact details.

## Implemented

- Twenty public pages have initial HTML with visible text, headings, service links,
  unique titles and descriptions. Search crawlers can read the content without
  running the quote, form or tracking JavaScript.
- Canonicals use the production HTTPS domain and exclude query parameters.
  The production www host redirects to the canonical host. Vercel normalizes
  trailing slashes and .html URLs. Unknown routes return 404.
- Organization, WebSite, page, service, service catalog and breadcrumb structured
  data connect the actual business and five services. There are no invented
  addresses, ratings, reviews, fixed prices or guaranteed delivery promises.
- Service pages link directly to related services. The shipping guide covers
  service selection, actual/volumetric weight, packing, quote details, documents,
  restricted items, extra charges, pickup and tracking.
- Open Graph and Twitter metadata use relevant service images and update on
  browser navigation. Images have dimensions and descriptive alt text. Public
  pages use the small PNG favicon instead of downloading the 1.7 MB SVG icon.
- The sitemap includes eligible canonical pages. Tracking, private staff/API URLs
  and missing pages remain unindexed. Preview builds stay noindex and have an
  empty sitemap and disallow-all robots rules. Public scripts remain crawlable.
- Every build audits generated HTML for missing/duplicate metadata, H1s,
  canonical/indexing mistakes, invalid schema references, missing images, broken
  internal links/anchors and sitemap inconsistencies. A failed audit stops release.

## Google Business Profile: owner setup

1. Create and verify the profile with the genuine business name. Choose the most
   accurate available courier category and list the areas actually served.
2. Choose the service-area model and hide the non-customer-facing address.
   Use the website, phone and business name above consistently.
3. Add actual hours, original business/shipment photos and the five offered
   services: international courier, domestic express, international air cargo,
   surface cargo and export dangerous-goods enquiries. DG acceptance needs review.
4. Use https://royaltservices.in/ as the website and
   https://royaltservices.in/pickup for collection requests where an appropriate
   booking/service link is supported.
5. Share the verified profile link and confirmed hours. Add the profile URL to
   config.seo.googleBusinessUrl and actual public social URLs to sameAs in
   site-config.js. Add visible config.hours when supplied. Leave serviceAreaOnly
   true and localBusinessVerified false while there is no public office.
6. Request honest reviews from real customers without incentives, and respond to
   customer questions. Keep service areas, contact information and hours current.

## Google Search Console: owner setup

1. Add the royaltservices.in Domain property and verify through the DNS TXT record
   Google provides. This covers HTTPS and subdomains. Do not remove existing
   email or Vercel DNS records. Alternatively use an HTTPS URL-prefix property;
   its HTML verification token can be added to config.seo.searchConsoleVerification.
2. Submit https://royaltservices.in/sitemap.xml in Sitemaps.
3. Inspect Home, /services/international-courier, /services/domestic-express,
   /quote and /pickup. Run Live Test and request indexing for key pages.
4. Review Pages indexing and Google's selected canonicals. Check Core Web Vitals
   and PageSpeed Insights after deployment. Field performance needs real usage;
   an automated HTML audit does not measure it.
5. Monitor impressions, clicks, queries, country/device and landing pages. Compare
   enquiries from organic traffic with these results. Improve content using real
   customer questions and actual service coverage rather than copied city pages.

Submission, verification and a public website do not guarantee indexing or rankings.
Google controls crawling, indexing and search presentation. No Search Console
verification, sitemap submission or Business Profile creation is claimed by code.

## Verification commands

- npm run build: generate pages and run the SEO release audit.
- npm run audit:seo: repeat the audit on the production dist folder.
- npm test: run SEO, preview protection, navigation, staff and quote regressions.
- npm run check: check JavaScript syntax.

## Official guidance

- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google title links](https://developers.google.com/search/docs/appearance/title-link)
- [Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization)
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Service-area business setup](https://support.google.com/business/answer/9157481?hl=en)
- [Business representation guidelines](https://support.google.com/business/answer/3038177)
- [Improve local ranking](https://support.google.com/business/answer/7091)
