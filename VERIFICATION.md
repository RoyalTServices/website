# Frontend verification

Completed 13 October 2026.

Design revision: replaced cream backgrounds with white, simplified copy across pages, removed decorative italic headings and rebuilt the homepage illustration. Syntax checks passed; homepage and major inner pages checked at 390 px with white body backgrounds and no horizontal overflow. No browser application errors observed after the revision.

Branding/photo revision: removed the separate header tagline, increased header logo dimensions, replaced footer wordmark with the supplied logo, and embedded the logo in the SVG delivery van. Both homepage and services page now share six photo cards. At 1280 px, the grid reported three columns and exactly two row positions. All six remote photos loaded. At 390 px, services and homepage had no horizontal overflow and the first service card navigated to its detail page. Source URLs are recorded in assets/PHOTO-SOURCES.md.

Original-image revision supersedes the remote-photo check above: generated six new realistic service images with the built-in image tool, using no source images. Replaced all external service-photo URLs with local JPEG assets. Verified all six loaded on the services page and the homepage references the same local files. Mobile services page has no horizontal overflow. JavaScript syntax check passed. Final generation prompts and file paths are recorded in assets/service-image-prompts.json and assets/PHOTO-SOURCES.md.

Blank-page fix: the active preview server rejected new assistant module files, causing the static assistant import to block the main application. The server now serves root-level JavaScript modules without an individual filename list. The assistant loads through a caught dynamic import after the main page renders. Verified all eight current root modules return HTTP 200 with a JavaScript content type; package.json remains HTTP 404. Application/server syntax checks passed. Reloaded the browser and confirmed the homepage and Ask Royal T control both render.

About/service-content revision: expanded About Us and all six service detail pages; each service now has five service-specific content sections and an image. Removed the separate services-listing renderer and its header link. Verified the footer Services link scrolls to the six homepage cards, and direct `/services` navigation resolves to `/#services`. Checked all six detail pages at 390 px: each rendered five sections without document horizontal overflow. App and service-content module syntax checks passed.

- JavaScript syntax checks passed for application and preview server.
- Five Node pricing tests passed: source rate examples, UPS spot-rate boundary, weight-slab selection, per-kg precision, provisional mapping and unavailable rates.
- Browser checked the homepage, services directory, all six service pages, quotes, tracking, pickup, about, contact and shipping notes.
- Mobile layout checks at 390 px reported no document horizontal overflow on all pages. The homepage was also checked at 320 px. Desktop appearance reviewed at 1280 px.
- Mobile navigation opens and navigates correctly.
- Quote form verified with USA 1 kg, Canada 2.5 kg and USA 301 kg; UPS heavy shipment correctly presents an enquiry.
- Tracking submission clearly states that the ID was not checked because no API is configured.
- Pickup and enquiry forms prepare local requests without claiming submission.
- No application console errors observed during browser checks.
- Desktop and mobile screenshots saved in `preview/`.

Live API integrations, approved current selling prices and final client policies are outside this frontend verification and remain pending.
## Customer assistant verification — 13 October 2026

- `npm test`: 12 tests pass, including all 210 example phrasings, the requested overdue delivery example, complaint/price distinctions, unknown-query handling, the three-attempt gate and successful feedback reset.
- `npm run check`: application, server and both assistant modules pass syntax validation.
- In-app browser at `http://localhost:4174`: verified opening, free-text suggestions, drafted answers, pricing guidance, feedback, conversation retention through site navigation, three unsuccessful responses unlocking the issue form, and local issue preparation with consent.
- Mailbox submission remains unverified because no mailbox backend is configured. The empty-endpoint flow explicitly says the issue was not sent.
- Download button was rendered and clicked, but the browser automation timed out waiting for its download event; saving the file was not independently verified.
- Desktop screenshot: `preview/assistant-desktop.png`. Mobile layout has responsive CSS but was not browser-verified in this pass.
## Trained assistant and context verification — 13 October 2026

- Replaced keyword scoring with a locally trained, reproducible multinomial logistic regression intent classifier. `npm run train:assistant` trains 35 courier topics and an unknown class on 519 labelled examples.
- `npm run evaluate:assistant`: 105/105 development validation sentences select the expected first question, 35/35 separate challenge sentences select the expected first question, and all 15 unrelated cases are rejected. Development feature rules were refined against the validation set. These curated results do not establish real-world accuracy.
- The automated suite also checks typo handling, short contextual follow-ups, topic switching, clarification, clearing context and the three-attempt issue gate.
- Browser verified: an underspecified first message asks for a topic; selecting Pickup lets “It is still not done” retrieve the missed-pickup question; “Can you cancel it” uses pickup context; a Canada pricing query overrides pickup context. Follow-ups keep the failure count at zero. Three explicitly rejected answers still open the issue form.
- Mailbox delivery still requires `assistantIssueEndpoint`; the current final form correctly states that nothing is sent when it is empty.
## Website policy drafts — 13 October 2026

- Added six policy pages and a business/policy index for Royal T Services Private Limited, all marked as drafts pending confirmation of missing operating details.
- Added site-wide policy links, a footer business disclosure and privacy links in contact, pickup and assistant-issue consent wording.
- Rendering all seven routes confirms the draft label, supplied legal operator and absence of undefined values. Syntax checks cover both new modules and the edited application/configuration.
- Browser preview verification was blocked by the browser URL security policy; no screenshot or visual pass is claimed for this change. Responsive policy/footer CSS is present but remains visually unverified.
- `POLICY-REVIEW.md` records the legal references, actual data flows and missing particulars. The drafts do not assert approved service liability limits, automatic legal compliance or fully operational DPDP rights before applicable commencement.
## SEO and server rendering — 13 October 2026

- Shared `pages.js` renders real public content in both initial server HTML and client navigation. All 21 public routes have unique titles/descriptions and one H1; a crawlable services index and six visible home shipping questions are included.
- SEO configuration uses the confirmed +91 90001 59988 phone. Domain and location remain unconfirmed. LocalBusiness markup is gated on confirmed complete address data; otherwise Organization/Service/Breadcrumb data is used. Previews without a public HTTPS origin are deliberately unindexed.
- Six SEO checks pass, including local HTTP verification of real service text, canonical Host-header isolation, gzip, module delivery, rate data, HEAD, 301, 404, sitemap and private/API noindex. Full regression suite: 35 tests pass. Syntax checks cover the shared renderer and SEO/server modules.
- Browser UI checks were not repeated because a prior browser URL-policy block remains unresolved. No new visual or live Google indexing pass is claimed. HTTP/source checks verify server-rendered search content independently of a browser.
- `SEO-LAUNCH.md` describes actual-domain configuration, deployment requirements, Google Business/Profile alignment, Search Console and post-launch validation. Draft policy, staff and tracking pages are omitted from sitemap indexing.
## Hyderabad/Telangana search targeting — 13 October 2026

- Set the canonical public origin to `https://royaltservices.in` and the target customer markets to Hyderabad/Telangana. Actual office address remains unset; no street address, geographic coordinates or verified LocalBusiness location was invented.
- Added regional titles/descriptions, affordable courier home wording, low-cost quote guidance, abroad-shipping context for service pages and practical shipment-efficiency questions. No guaranteed-lowest-price, fastest-delivery or fabricated rating claim was added.
- Added SEO regression checks for the real configured canonical/sitemap URLs and regional content/schema distinction. Production domain configuration is ready; public deployment and Google submission are separate actions.
# Vercel setup

The Vercel build renders 21 public pages and a custom 404 into an explicit public output directory. Production canonical URLs use royaltservices.in; preview HTML, client configuration and robots rules prevent preview indexing. Database storage is required on Vercel, with no ephemeral JSON fallback. Staff setup requires a private key, sessions and login limits persist in storage, and cookies are Secure on Vercel.

Six new checks cover public output/private-file exclusion, preview noindex, missing-database failures, staff setup/session/logout across separate handlers, the Vercel rewrite and parsed body adapter, and transaction rollback/error sanitization. Database transaction checks use a test double; no live hosted database or Vercel deployment has been exercised. Complete the live checks in VERCEL.md after configuring credentials.
# Supabase integration

Prepared an additive Royal T migration, Supabase SSR Auth/server routes, private PDF storage, cached tracking, courier normalization and hourly sync endpoint. PostgreSQL tests execute the migration and verify idempotent intake, event deduplication, rate limits, sync locking, staff/RLS restrictions, role escalation rejection, revoked-session rejection, enquiry conversion and atomic/versioned shipment updates. DOM tests exercise staff booking/edit and document/payment views, plus admin invitation controls with mocked APIs. Supabase SDK versions are pinned.

The connected Supabase account denied access to vjnfefdfvneiqbkduezt. No hosted schema, Auth account, bucket or external cron job was changed, and no courier shipment was booked. Real Auth/Storage, provider credential and migration/advisor checks remain pending project access and environment configuration. The prepared Supabase branch must not replace the current production backend until those steps are complete. See SUPABASE.md.
