# Royal T Courier frontend

Custom native JavaScript, CSS and SVG. No UI kit or frontend framework. Use Node 22 and run `npm ci` before the development preview.

## Vercel

Deployment configuration is included. Supabase is the primary production backend. Follow [SUPABASE.md](SUPABASE.md) for the migration, server variables, invite-only Auth, private PDF storage and tracking scheduler; [VERCEL.md](VERCEL.md) covers the standalone import. `npm run build` renders the public pages into `dist`; the Vercel Node function handles requests and staff APIs. Public pages can deploy independently, but saved requests and staff access require the database environment variables.

Visual direction revised to a traditional business website: white backgrounds, plain service headings, regular sans-serif typography and direct descriptions. The homepage shipping illustration includes a labelled carton, domestic delivery van, cargo aircraft and globe routes. Only route markers gently highlight; the parcel does not float. Reduced-motion preferences disable the highlights.

The supplied client logo appears in the header, footer and delivery van. Home and services pages use a shared six-photo grid: three columns on desktop, two on tablets and one on phones. All six service photos are original generated assets hosted locally under `assets/services/`. Provenance is documented in `assets/PHOTO-SOURCES.md`; exact prompts are saved in `assets/service-image-prompts.json`.

## Preview

Run `npm run dev`, then open http://localhost:4173. All page URLs support direct navigation and initial HTML rendering with the included server.

The local server renders public pages and SEO metadata directly into their initial HTML using `pages.js`, `seo.js` and `site-server.mjs`. The Vercel build uses the same renderer to generate complete HTML for each route. Set the public HTTPS domain in `config.seo.siteUrl` or `SITE_URL` for production canonicals and sitemap generation. Vercel preview builds deliberately remain unindexed. See `SEO-LAUNCH.md` for Google Business Profile, location/schema and Search Console setup.

## Pages

Home with a six-service grid, six detailed service pages, quotes, tracking, pickup, about, contact and shipping notes. The separate services listing has been removed; `/services` redirects in the frontend to `/#services`. Header navigation includes Home, About us, Track shipment, Contact and Get a quote.

About Us covers the business, its customers and shipment support process without invented company history or credentials. Service-specific descriptions, preparation information and quote requirements are maintained in `service-content.js`.

## Configuration

Edit `site-config.js` to supply phone, WhatsApp (international digits), email, address and business hours before launch.

Enquiries, quotation/booking requests, pickups and assistant support issues use `/api/requests`. Cached public tracking uses `/api/tracking`. These require the Supabase migration and server environment variables. Staff use Supabase Auth through HttpOnly cookies; there is no public registration. See SUPABASE.md for setup and live verification.

### Tracking endpoint

Set `trackingEndpoint` to a same-origin endpoint or CORS-enabled public URL. The frontend sends `GET endpoint?id=TRACKING_ID`. Normalize the API response to:

```json
{
  "status": "In transit",
  "estimatedDelivery": "15 October 2026",
  "events": [
    {"status": "Shipment collected", "location": "Hyderabad", "timestamp": "13 October 2026, 10:20 IST"}
  ]
}
```

Return HTTP 404 for an unknown ID. The UI handles loading, missing shipments, empty events, timeouts and API errors. Adapt `loadTracking` to the actual API contract when provided. Keep secret carrier API keys on a backend.

### Request endpoint

Set `requestEndpoint` for enquiries and pickup. The frontend sends JSON with `type` (`pickup` or `enquiry`) and the named form fields. A successful 2xx response means receipt only, not shipment booking. Backend validation, consent/privacy handling and spam prevention must be implemented before accepting public requests.

## Pricing data

`data/rates.json` contains numeric results from the supplied workbook formulas. `scripts/extract_rates.py` rebuilds it with Python and openpyxl, without modifying originals. Formula caches must be recalculated in a spreadsheet application when the source prices change.

- Effective dates: 11–17 October 2026; expired rates display as historical references.
- Carrier mappings now come from `Dhl New Zone List.xlsx / Zones(Dhl)` and `UPS ZONES_Export Only.xls / Zones / Export Saver`. DHL uses its own country zones and the separate 9A column. Missing mappings require a manual enquiry. The union includes 266 destinations. See `NEW-ZONE-FILES-REVIEW.md` for the source comparison.
- An unsupported destination group produces a manual enquiry, not a fabricated price.
- UPS at 300 kg and above goes to manual pricing: the sheet instructs spot-rate enquiries above 300 kg, but its final usable numeric band ends at 299 kg.
- DHL includes per-kg bands above 30 kg, including above 300 kg.
- All-in workbook values are used without adding fuel/tax again. Other surcharges and destination duties are excluded from the reference estimate.
- Chargeable weight is an input. No unconfirmed dimensional divisor is invented. Above-table weights round up to a whole kilogram; carrier rounding and per-kg rules need confirmation before live pricing.
- The UI exposes only reference rates, not client selling prices. Confirm public pricing and margin before launch.

## Customer assistant

The floating **Ask Royal T** assistant works on every page. `assistant-knowledge.js` contains 35 drafted topics and answers. A supervised multinomial logistic regression classifier is trained on **519 labelled examples**: the 217 library phrasings, 280 fuller customer sentences in `assistant-training-data.js`, and 22 unknown/ambiguous examples. Generated weights live in `assistant-model.js`; classification runs locally, without an external AI service or sending conversations to a training provider. This is a courier intent classifier, not a general-purpose language model.

`assistant-nlu.js` extracts words, word pairs, character fragments and courier context features, preserving negation. It normalizes common synonyms, informal pickup wording and one-edit spelling errors in courier terms. Features distinguish missed collections, booking changes, delivery delays, disputes, damaged/missing contents, pricing, customs and other supported topics. Confidence and vocabulary checks avoid forcing low-confidence or unrelated questions into an answer. Scores are ranking signals, not calibrated probabilities of correctness.

The assistant remembers the most confident customer topic or a selected question for short follow-ups. For example, after discussing pickup, “it is still not done” suggests a missed pickup, and “cancel it” suggests changing/cancelling the pickup. Explicit new topics override previous context; successful feedback and New chat clear it. An ambiguous first message asks for a topic rather than guessing. Choosing a browse topic provides context for the next message. The answer view also accepts typed follow-ups. Answers use approved site guidance and do not invent prices, shipment events or claim approvals.

Rejecting a suggestion list or answer counts as one unsuccessful attempt. An unmatched query counts once automatically, except a clarification prompt: answering that clarification is not a failure. Ordinary follow-ups and topic changes do not count as rejections. Positive feedback resets the count. After three unsuccessful attempts the issue form collects name, reply email, optional tracking ID and a description, with consent to include the transcript. Conversation state and unsent form fields use sessionStorage in the current browser tab so navigation and refresh retain the conversation. New chat clears the conversation; closing the tab ends browser session storage.

Set `assistantIssueEndpoint` in `site-config.js` to connect the last-step mailbox submission. It receives a JSON POST:

```json
{
  "type": "assistant_issue",
  "name": "Customer name",
  "email": "customer@example.com",
  "trackingId": "optional ID",
  "message": "Issue description",
  "consent": true,
  "unsuccessfulAttempts": 3,
  "transcript": [{"role": "customer", "text": "My delivery is late"}]
}
```

The backend must validate and limit fields, check consent, escape customer text in emails, apply spam/rate limits, and deliver or durably queue the issue for the configured support mailbox before returning 2xx. Keep mail credentials on the backend. The configured `/api/requests` endpoint stores support issues in the internal Enquiries queue. It does not send an email; connect a separate reviewed mail-delivery service if required. When this endpoint is empty, the assistant only prepares a text download and explicitly says nothing was sent. Submission failures preserve the form for retry. Review the drafted answers and connect this endpoint before offering mailbox delivery publicly.

To improve training, add reviewed, anonymous customer sentences under their intent IDs in `assistant-training-data.js`, then run `npm run train:assistant`. This reproducibly rebuilds the model. Do not train on evaluation fixtures or silently add customer personal details. Changes to feature extraction also require retraining.

Run `npm run evaluate:assistant` for the curated development validation and separate challenge set; results are written to `data/assistant-evaluation-report.json`. The 105 development sentences were used to refine feature rules, not train classifier weights. The separate 35-sentence challenge set was written after feature development. These tests cover paraphrases across all topics; they do not establish performance on unreviewed real customer traffic. Keep a separate evaluation set as new examples are added.

Run `npm test` for rate, classifier, spelling, context, unknown-query and escalation checks, and `npm run check` for syntax validation.

## Launch checklist

Website policies are drafted in `legal-content.js` and displayed through `legal-pages.js`, with footer links and form privacy notices. The operator is Royal T Services Private Limited. Complete the registered address, CIN, applicable GSTIN, support email and designated grievance/privacy contacts in `site-config.js`; review actual retention, carrier/claim and refund procedures before changing `legal.status` from `draft` to `published`. See `POLICY-REVIEW.md` for current implementation facts, regulatory references and remaining launch details. Adding policy pages does not by itself establish legal compliance.

The new [internal staff workspace](INTERNAL-APP.md) is available at `/internal`. The Supabase routes provide invite-only staff authentication, shipment management, customer records, enquiry intake, documents, payment bookkeeping and cached tracking. Assistant issues enter the internal enquiry queue. See the internal app guide for setup, persistence and deployment requirements.

Supply contact details and approved business content; approve current public tariffs, DHL mappings and weight rules; connect APIs; publish privacy, liability, service and cancellation terms. Do not deploy the development server as the public production server. Assets are local except optional Google Fonts; system fallbacks work without them.
