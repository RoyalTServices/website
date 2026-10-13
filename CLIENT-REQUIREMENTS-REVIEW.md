# Client input review

Reviewed on 13 October 2026. Frontend implementation completed after user authorization.
Updated after build authorization: the custom frontend is now implemented. The new carrier zone files replace the temporary shared UPS mapping: DHL uses Zones(Dhl), and UPS uses Export Saver. Missing carrier mappings require an enquiry. Tracking API will be provided later. Brand logo was supplied in the workspace and is included in the design. Contact details remain pending before launch.

## Received

- Service reference: https://www.worldfirst.in/ (service scope reference; original design required).
- DHL COLOADER RATE 11-10-2026 TO 17-10-2026.xlsx
- UPS_World first Partner All in Rates 11.10.2026 to 17.10.2026 (1).xlsx

The workbooks are partner/co-loader pricing documents. Original workbooks are preserved. The user confirmed that the services match the reference site: domestic express parcels, international air cargo, international courier, imports express, surface cargo and export dangerous-goods cargo. Contact details will be supplied a day or two before launch and do not prevent preparing the site.

## Pricing issues and proposed handling

| Finding | Handling for a future implementation | Still needed |
| --- | --- | --- |
| Current rate sheets cover 11–17 October 2026 only. | Store effective dates; do not offer an expired rate as a current automatic quote. | Rate update process and person responsible. |
| UPS `Partner Base!A79` and `PB+DC!A83` explicitly instruct raising a query for spot rates above 300 kg. The error cells in rows 72–74 are outside the usable listed price slabs. | Implement the above-300 kg query rule. Do not repair these cells by inventing rates. For exactly 300 kg, the notes say the rate sheet applies but the last numeric slab ends at 299 kg; use a manual quote until a price is supplied. | No heavy-shipment rate repair is required for the enquiry workflow. |
| UPS `US & CA (2)` is dated 9–15 March 2026; scratch sheets and a second demand-charge sheet are also present. | The current formula chain is `Partner Base` + `Demand Charges` → `PB+DC` → `Partner Base++` → `US & CA`. Exclude historical and scratch tabs from current quoting. | Client selling margin if prices are to be displayed publicly. |
| DHL has zone prices but no country-to-zone lookup sheet. Canada is labelled Zone 9 or 9A in different sections. | Keep carrier mappings separate; do not apply UPS zones to DHL. USA and Canada have dedicated columns. | DHL country-zone mapping and confirmed Canada zone identifier. |
| DHL calculated rates use 49%, 18%, and an additional factor of 1.0575. Its co-loader sheet also adds 5% to the base. UPS calculated rates use 52.5% and 18%. | Preserve supplied all-in rates without adding the same components again. | Explanation of each factor, surcharge inclusion, applicable tax treatment, and client's selling margin. These percentages are workbook observations, not independently verified current carrier rules. |
| Weight slabs exist, but volumetric-weight calculation and rounding rules are absent. | Require confirmed chargeable-weight rules before implementing automatic quotes. | Dimension units, divisor, rounding increments, multi-box rules, and whether heavier slab rates apply per kg to the whole shipment. |
| Surcharges depend on remote areas, dimensions, handling and shipment contents. Complete lookup data is absent. | Do not present a conditional estimate as a guaranteed final charge. | Remote-area/postcode lists and approved surcharge rules. |
| UPS liability wording differs across sheets; shipment restrictions are included. | Treat these as client-supplied notes requiring an approved public policy. | Final shipping, liability, prohibited-item and restricted-item policies. |

## Missing website brief

1. Confirmed business name, logo, brand colours, company description and approved images.
2. Phone, WhatsApp, email, address, business hours and service locations.
3. Services are confirmed to match the reference. Pickup coverage and delivery estimates still need client content if displayed.
4. Required pages and features: enquiries, quote calculator, pickup requests, tracking, bookings, payments and customer accounts.
5. Tracking source: carrier links, carrier API, existing client portal or manual status management.
6. Quote pricing: public selling rates versus partner costs, margin rules and price visibility.
7. Enquiry/pickup destination and workflow: who receives requests, which fields are needed and how staff respond.
8. Whether an admin area is required for rates, shipments, enquiries and content.
9. Approved privacy, terms, cancellation/refund and shipping policies.
10. Domain, hosting, languages and launch requirements.

## Next step

Continue collecting the remaining brief before the user authorizes building. Contact details can be added before launch. If live quoting is requested, resolve the inputs needed for that feature before enabling it. Rates and business rules must not be invented to fill gaps.

## Complete tab review

All 17 tabs were rechecked, including text notes, rate tables and formula references.

| Workbook | Tab | Role |
| --- | --- | --- |
| DHL | Dhl | Base export rates; documents through 2 kg, parcels through 30 kg, per-kg multiplier bands above 30 kg, including bands above 300 kg. |
| DHL | cooloder rate | Base rates multiplied by 1.05. |
| DHL | DC | Demand-charge component by zone and weight. |
| DHL | go green | Additional component, generally 30 per kg with a minimum of 30 in the listed small-weight rows. |
| DHL | COLAODER++ | Combined calculated rates: `((co-loader + DC) × 1.49 + go green) × 1.18 × 1.0575`. |
| DHL | US &CA | USA/Canada summary linked to COLAODER++, with per-kg bands through 300 kg and explicit additional surcharges. |
| UPS | Zone list | Country/territory-to-zone lookup, special destination groups and China postcode distinctions. |
| UPS | Partner Base | Base rates and terms, including above-300 kg spot-query instruction, per-box limits, girth rules and remote-area charges. |
| UPS | Demand Charges | Demand component used by the current PB+DC formulas. |
| UPS | PB+DC | Adds base and demand components; repeats above-300 kg spot-query instruction. |
| UPS | Partner Base++ | Current all-in rate table, generally adding 52.5% and 18% with upward integer rounding; also contains country grouping and shipment conditions. |
| UPS | US & CA | Current USA/Canada summary linked to Partner Base++, dated 11–17 October 2026. |
| UPS | Sheet1 | Two intermediate heavy-weight values; no complete independent tariff. |
| UPS | Sheet2 | Unlabelled intermediate pricing calculations; no dated public tariff. |
| UPS | Sheet3 | Partial special-zone code notes. |
| UPS | US & CA (2) | Historical March 2026 pricing and gross-profit calculations. |
| UPS | Demand Charges (2) | Alternative demand values; not used by the current PB+DC chain. |

The UPS above-300 kg instruction must not be applied automatically to DHL: DHL's main rate table includes higher-weight bands. DHL's USA/Canada summary stops at 300 kg.

Additional mapping inconsistency: UPS `Partner Base++!A101` labels Albania with `SV*`, while `Zone list!A6` correctly lists `AL`. Prefer the dedicated Zone list for lookup; the embedded grouping is not a clean code authority. This can be normalized during a future import without altering original client files.
