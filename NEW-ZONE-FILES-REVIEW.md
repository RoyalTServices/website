# Review of the new carrier zone files

Reviewed all seven worksheets on 13 October 2026. Following client approval, the website now uses DHL Zones(Dhl) and UPS Export Saver mappings. The destination list is their union (266 destinations); routes without a carrier mapping require a manual enquiry. DHL 9A uses its separate rate column. Original price values and validity dates are retained.

## DHL — Dhl New Zone List.xlsx

| Worksheet | Contents | Finding |
|---|---|---|
| Sheet2 (2) | Country/territory and zone list | Uses an alternate zone scheme, including zones 18–21. It cannot be applied directly to the existing 1–14 rate columns. |
| Zones(Dhl) | 233 unique country codes, country names, carrier zone labels and numeric zones | This tab supplies the carrier-specific mapping compatible with the existing DHL rate layout. It contains zones 1A–14A, plus numeric counterparts. |
| Sheet2 | Alternate list, formatted labels and separated country codes | Contains the alternate zone scheme, rather than the adapted Zones(Dhl) mapping. |

135 country entries differ between Zones(Dhl) and at least one alternate list. Examples: Afghanistan is 11A in Zones(Dhl) versus 20 in the alternate lists; Albania is 11A versus 21; Andorra is 8A versus 18. Use the adapted Zones(Dhl) mapping with the supplied coloader rate table, rather than mixing these schemes.

The rate workbook contains ordinary numeric zone columns 1–14 and a distinct Zone 9A column. This distinction matters: Canada is 9A and should use its dedicated Canada / Zone 9A column. Other 9A destinations also require checking against this named column rather than blindly stripping the A suffix. USA is 12A; the existing explicit US column is Zone 12. For the other labels, the numeric counterpart provides the matching column in the current workbook. The new file contains no tariff amounts or updated validity period.

Examples from Zones(Dhl): Austria 7A, Germany 7A, UK 7A, USA 12A, Canada 9A, Australia 14A, New Zealand 6A, Singapore 2A, UAE 1A. These replace the temporary shared UPS mapping. Comparing by current destination code changes 217 mappings under the earlier comparison assumption (which retained US/Canada overrides). This count is an audit comparison, not a claim that all destinations are ready to quote.

13 current website destination codes have no direct match in Zones(Dhl): AX, A2, BQ, B1, CW, KO, NF, NB, BL, SX, TA, WL and WF. Some may be aliases or territories of an entry present in DHL; those relationships are not explicitly established by these files. They should not silently inherit UPS zones. Use a manual DHL enquiry until an explicit mapping is supplied or verified.

Zones(Dhl) also contains 211 #N/A cells in auxiliary lookup columns. The primary country code and zone columns are populated; the auxiliary errors must not be used as quote data.

## UPS — UPS ZONES_Export Only.xls

| Worksheet | Contents | Finding |
|---|---|---|
| Zones | 250 country/territory rows; separate export and import columns for Plus, Express, Saver, Expedited and Freight | The current website UPS product is Express Saver. Use the Export Saver column, not a generic zone or import column. |
| Sheet1 | 33 country codes | Supporting list without prices or column labels. It is not a complete country-zone mapping. |
| Region | Regional groupings | Supporting group labels; not shipping rate zones. |
| Import | Separate import Saver, Express and Expedited mappings | Import-only reference data. No corresponding import tariffs were added. |

All current website destinations match the new Export Saver list by cleaned name. Seven zone assignments differ:

| Destination | Current | New Export Saver |
|---|---|---|
| British Virgin Islands | 7 | 7A |
| Heligoland (Germany) | DE | 4 |
| Nicaragua | 7A | 7 |
| St. John (US Virgin Islands) | 7 | 7A |
| St. Thomas (US Virgin Islands) | 7 | 7A |
| U.S. Virgin Islands | 7 | 7A |
| Virgin Gorda (British Virgin Islands) | 7 | 7A |

Country codes repeat for some territories. For example, Germany and Heligoland share DE but have different zone labels. Match the destination row as well as the country code. Keep special labels such as 6A, 7A, US, CA and AU intact when selecting the corresponding existing rate column.

Despite its filename, the UPS file includes import data. The Zones Import Saver column and the Import worksheet differ for Afghanistan (unavailable versus 9) and San Marino (6 versus 9). These need resolution if import quoting is later enabled. They do not affect the Export Saver column.

## Outcome

Carrier-specific mappings are now supplied; there is no reason to keep sharing UPS zones with DHL. The appropriate sources are DHL Zones(Dhl) and UPS Zones → Export Saver. Both new files are zone/supporting-data files, not replacement price tables. Existing tariff dates and the heavy-shipment enquiry logic remain dependent on the original rate workbooks.

The mapping update preserves DHL's dedicated 9A column and applies the seven UPS destination-row corrections. Exact destination-name matches also resolve the different carrier codes for Curacao (CW / XC), St. Barthelemy (BL / XY) and Kosovo (RS / KV), without duplicate dropdown entries. Each destination retains its carrier-specific mapping. Unmatched destinations remain manual enquiries. Full extracted worksheet data and the original comparison are saved in data/new-zone-workbook-review.json and data/new-zone-comparison.json.
