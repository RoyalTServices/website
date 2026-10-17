# Staff rate lists

Staff and administrators can open **Rate list** from the staff workspace. Download the predefined template, or download the current rates to edit. Update the complete workbook and use **Validate and publish rates**. Publishing takes effect for new website quotes without a website rebuild.

The `.xlsx` template has Instructions, Settings, Destinations, Rates and Self sheets. Preserve the sheet names and headings. Prices are numeric INR values, with no formulas. Start dates are text in `YYYY-MM-DD` format. Leave `validUntil` and `selfValidUntil` blank to keep prices valid until replaced; optional expiry dates remain supported. The owner confirmed on 17 October 2026 that the current rates remain effective until changed, so both expiry dates are blank in the template. Blank Self prices require an enquiry; zero and negative prices are rejected. The maximum upload is 1.5 MB. The template contains the current starting rates so staff need only edit the applicable values.

The private `royalt-rate-lists` Supabase Storage bucket holds the uploaded Excel files. Only the latest three files are retained after each successful upload; older files are deleted. Previous files can be downloaded from the staff page. Failed old-file cleanup is reported and offers a retry button. A database singleton contains only the active file path, publication metadata and an upload lock. Prices are read from the Excel file in Storage. Neither anonymous users nor browser clients can access the bucket or publication controls directly; the existing authenticated staff API manages uploads and downloads.

Validation happens before Storage changes. A service-only lock serializes publication and retention. The public rate endpoint checks the active path for every request, with parsed content cached only for that immutable path. New quotes refresh from this endpoint, so a published change cannot leave an existing browser using a cached rate list. A backend failure displays a rate-loading error and permits a separate enquiry.

## Initial client workbooks

`scripts/import-updated-rates.py` imports the customer-facing `royalty dhl` sheet from `royal T dhl updated.xlsx`, the `royal t services` sheet from `ups rates royalty updated.xlsx`, and `self updated.xlsx`. It preserves the previously verified carrier zone mappings. The UPS cost and intermediary markup sheets are not customer prices.

Self rates use the user-confirmed rule: half-kilogram increments below 6 kg and per-kilogram pricing at the 6/8/11/16/21/26 kg thresholds, rounding up to the next whole kilogram. Separate regional and duty-paid variants retain their names and restrictions. Missing or suspended prices require an enquiry. The source's New Zealand 6+ column applies throughout its permitted range. Shipment and box restrictions remain attached to the route. Country-name aliases match the existing destination list, including the separate Serbia and Montenegro destinations.

Run `node scripts/prepare-rate-template.mjs` after importing initial prices. This generates the downloadable asset and the server's initial workbook seed. The backend initializes Storage from that workbook when no list exists. Updates to the bundled seed may refresh an initial list until a staff member publishes their first list; staff-uploaded lists always take precedence thereafter.

## Deployment

The rate-list migration is applied to the existing Royal T Supabase project, and `royalt-api` version 6 is deployed. The live rate endpoint has been verified with 266 destinations and 82 Self destination/service combinations. The frontend is included in this release and ships through the existing GitHub/Vercel production workflow.

Apply `supabase/migrations/20261016142434_rate_lists.sql`, run `npm run prepare:edge`, and deploy `royalt-api` with its import map and generated module copies. The migration also registers the Self managed courier option. Keep the existing verified staff authentication and service-only publication controls.

Then run `npm run build` and deploy the website build through its existing Vercel workflow. The Excel template is explicitly included in Git; client source workbooks remain ignored. Uploaded files never go into the website deployment or repository.

Validation: `npm run check`, `npm test`, and `npm run build`. Tests cover workbook round trips, invalid inputs, carrier examples, Self boundaries and restrictions, retention, seeding, staff overrides, staff UI, authorization and database locks/RLS.
