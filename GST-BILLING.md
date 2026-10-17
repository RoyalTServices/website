# Staff GST billing

**Business details** is available in staff login. Staff can view the defaults; administrators can change the registered business name, trading name, GSTIN, registration state, address/PIN, contact details, invoice prefix, default SAC, default GST rate, price basis, payment terms, bank/UPI details and authorised signatory name. The known business name and contact number are prefilled. A GSTIN, registered address, registration state, SAC and tax rate must be supplied before a bill can be issued. GSTIN checks validate format and checksum, not online registration status.

Selling prices include GST by default, as requested. Each invoice can use inclusive or exclusive prices. Per-line quantities, charges, discounts, SACs and GST rates are editable before issue. Monetary calculations use integer paise, including an explicit rounding adjustment when needed. The place of supply determines CGST + SGST/UTGST versus IGST; it must be selected explicitly rather than inferred from the parcel destination. Overseas parcel delivery does not itself select an export invoice. Explicit export-under-LUT and export-with-IGST treatments require an overseas recipient; LUT invoices require a reference and zero collected GST. Reverse charge requires a registered recipient and GST-exclusive prices.

## Staff workflow

1. Administrator: fill in **Business details**, including the actual GST registration details and accountant-confirmed SAC/rate.
2. Open a shipment, select **Confirmed** under booking status, and save. In-progress and completed bookings are also eligible. Pending and cancelled bookings cannot issue a new bill.
3. Click **GST invoice / print**. Review billing and delivery addresses, place of supply and charge lines. Preview does not issue a number.
4. Click **Issue GST invoice**, then **Print / Save as PDF**. The browser's print dialog supports A4 paper and PDF saving. The printed bill includes a physical signature area; no digital signature is fabricated.
5. Reopen the original bill from the shipment or **Invoices**. Search by invoice number, customer or booking reference.

Issuing is a deliberate step separate from booking confirmation. The database locks the booking, checks its current status and the supplier/booking versions, then assigns a financial-year number such as `RTC/26-27/00001`. Prefixes are 1–4 alphanumeric characters, and the full number is at most 16 characters. Indian financial years and issue dates use Asia/Kolkata. Retries and concurrent attempts on the same booking return the existing invoice rather than allocating another number. The counter and insertion occur in one transaction.

Issued bills preserve a complete supplier, recipient, booking and tax snapshot in Supabase. Printing does not depend on the current business settings or quote rate list. Invoices cannot be updated or deleted through the application or normal database writes. Booking changes or cancellations do not rewrite an existing bill; a credit/debit-note workflow is a separate next feature. An invoice does not mark a payment as received.

This feature prints tax invoices; it does not file GST returns, register IRNs, generate government-signed QR codes or integrate with an Invoice Registration Portal. Any applicable e-invoice/IRN process remains separate.

## Backend and deployment

The billing migration `supabase/migrations/20261017065608_billing.sql` is applied to the Royal T Supabase project, and `royalt-api` version 6 is deployed. The frontend is included in this release and ships through the existing GitHub/Vercel production workflow. For subsequent backend updates, prepare/deploy `royalt-api` using `npm run prepare:edge` and include all generated dependencies and `deno.json`. The new settings, invoice and counter tables have RLS enabled, no anonymous/authenticated table access, and service-only operations behind the existing verified staff API. Settings writes require administrator role. Issued records are immutable. APIs use same-origin requests and no-store/noindex responses.

Validation covers inclusive/exclusive GST, tax jurisdiction, discounts/rounding, export and reverse-charge validation, escaped printable content, administrator permissions, confirmation gates, numbering/idempotence, immutable snapshots, private tables and staff UI navigation.

References: [CBIC tax-invoice particulars](https://cbic-gst.gov.in/gst-invoice-rules.html), [current Rule 46](https://taxinformation.cbic.gov.in/content-page/explore-rules/1000136/1000001), [official state codes](https://docs.ewaybillgst.gov.in/apidocs/state-code.html).
