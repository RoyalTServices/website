# Website policy draft and launch review

Drafted on 13 October 2026 for **Royal T Services Private Limited**, trading as Royal T Courier Services. The legal company name was supplied by the owner. All policies are visible in the local preview and marked as drafts. They are not a certification of legal compliance.

## Included pages

- `/privacy-policy`: enquiry/pickup data, local assistant conversations, support escalation, staff access, sharing, international shipments, retention, privacy requests and children.
- `/terms-and-conditions`: website use, quote versus booking, charges, external services, responsibility, complaints and preserved statutory rights.
- `/shipping-policy`: acceptance, packaging, chargeable weight, delivery estimates, customs, restricted goods, failed delivery, loss/damage and returns.
- `/cancellation-refund-policy`: requests before/after dispatch, valid charge bases, duplicate/incorrect payments, approved refunds and escalation.
- `/cookie-policy`: no installed public advertising/analytics integration, essential staff-session cookie, Google Fonts, WhatsApp and local downloads.
- `/grievance-redressal`: direct complaints independent of the assistant, evidence, proposed acknowledgement/review standards and external remedies.
- `/website-policies`: legal operator, business/contact details and an index of all policies.

Every page has footer policy links and a business disclosure. Contact, pickup and assistant-issue consent wording links to the Privacy Policy. Existing shipping notes now point to the drafted policies.

## Details still required

Fill `config.legal` and the business contacts in `site-config.js`: registered office, CIN, GSTIN if registered, genuine support email/phone, designated grievance officer and designation, grievance email/phone and privacy contact. The current phone was provided as 9999999999 and should be verified before launch. No address, registration identifier or officer has been invented.

The owner must confirm service-specific carrier terms, claim deadlines, insurance arrangements, permitted cancellation deductions, actual refund processing timelines and a record-retention schedule. No fixed liability cap or arbitrary no-refund exclusion was inserted. Have the final drafts reviewed for the actual business model before setting `legal.status` to `published`.

## Implementation facts and follow-through

The current request endpoint saves submissions in the internal store. Staff login uses an eight-hour `royalt_session` cookie. The assistant runs locally and keeps conversation state in memory; its issue endpoint is not configured. Public pages load Google Fonts. No public advertising/analytics integration or payment checkout was found. The notices reflect these facts rather than a generic template.

Policies alone do not implement retention/deletion operations, consent auditing, production security, carrier agreements or refund handling. Before public launch, assign someone to privacy/complaint requests, implement the agreed retention procedure, capture notice/consent versions, secure hosting and internal access, and verify the submission service. Re-review the notices when payment, Zoho Books, analytics or additional external services are connected.

## Regulatory references checked

- [MeitY: Digital Personal Data Protection Rules, 2025](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf): commencement is phased. Do not describe all provisions as already effective on 13 October 2026. Confirm the applicable Act commencement and rules for the actual launch date. The privacy draft offers request channels without asserting premature statutory deadlines.
- [Consumer Protection (E-Commerce) Rules, 2020, official government copy](https://thc.nic.in/Central%20Governmental%20Rules/Consumer%20Protection%20(E-Commerce)%20Rules,%202020.pdf): assess applicability to the business model; review business disclosures, grievance contact and process, consent and refund obligations.
- [PIB: E-Commerce Amendment Rules, 2026](https://www.pib.gov.in/newsite/erelcontent.aspx?lang=2&reg=48&relid=294532): the release states that the amendments commence on 1 January 2027. Assess future complaint-copy, National Consumer Helpline convergence and other applicable obligations for a launch on/after that date. Do not claim certification or NCH partnership before it exists.
- [MCA: Companies (Incorporation) Third Amendment Rules, 2016, rule 26](https://www.mca.gov.in/Ministry/pdf/CompaniesThridAmendementRules_28072016.pdf): company website identity/contact disclosures inform the shared footer and business-details page. Complete the missing particulars on the landing page before launch.
- [Google Fonts privacy information](https://fonts.googleblog.com/2022/11/your-privacy-and-google-fonts.html): external font requests are disclosed; self-hosting fonts can be evaluated separately.

Applicability and effective requirements require review against the final operating model. These sources informed original drafts; no third-party policy text was copied.
