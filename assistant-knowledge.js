// Approved draft answers and example customer wording. Edit here to expand the assistant.
// A supervised local intent classifier selects these answers; no live shipment lookup.
import {model} from './assistant-model.js';
import {features, concepts, normalize} from './assistant-nlu.js';
export {normalize} from './assistant-nlu.js';
const drafts = [
  ['late-delivery','Delivery','My delivery is overdue. What should I do?', ['not delivered','delivery due date','delivery overdue','parcel delayed','delivery late'], 'Check your tracking ID for the latest update. If the expected delivery date has passed, keep your tracking ID and due date ready for a delay enquiry. An expected date does not confirm the current shipment status.', '/tracking'],
  ['missing-parcel','Delivery','My parcel appears to be missing.', ['parcel lost','shipment missing','package disappeared','cannot locate parcel','lost consignment'], 'Check the last tracking event and confirm the delivery address. Keep the receipt and tracking ID ready so support can investigate. A lack of updates alone does not confirm a loss.', '/tracking'],
  ['false-delivery','Delivery','Tracking says delivered, but I did not receive it.', ['marked delivered but not received','says delivered but missing','delivered to someone else','proof of delivery','delivered but not here'], 'Check with household members, reception or security, then confirm the address on the receipt. Keep your tracking ID and request a delivery investigation if you still cannot locate it.', '/tracking'],
  ['damage','Delivery','My parcel arrived damaged. What should I do?', ['parcel damaged','box broken','contents damaged','package crushed','item arrived broken'], 'Keep the packaging, shipment receipt and photos of the box and contents. Describe the damage in your issue. The team must review the shipment before confirming any claim or compensation.', ''],
  ['missing-contents','Delivery','Items are missing from my delivered parcel.', ['items missing','contents missing','box empty','part of order missing','parcel opened'], 'Keep all packaging and your receipt. Record what was expected and what arrived, and retain photos for the team to review. Do not discard evidence before the enquiry is reviewed.', ''],
  ['attempt','Delivery','The courier attempted delivery while I was unavailable.', ['missed delivery','delivery attempt failed','not home','recipient unavailable','delivery attempted'], 'Review the tracking update and any notice left by the courier. Redelivery options depend on the carrier and destination. Keep your tracking ID and recipient contact details ready.', '/tracking'],
  ['address','Delivery','Can I change the delivery address?', ['wrong address','change delivery address','address correction','incorrect postcode','update recipient address'], 'Address changes require carrier review and may have additional charges. Share the tracking ID and corrected address with the team; a change is not confirmed until accepted.', ''],
  ['return','Delivery','Why is my shipment being returned?', ['return to sender','parcel returned','shipment returning','returned undelivered','rto'], 'Check the tracking event for the return reason. Address issues, delivery attempts or clearance issues can require review. The team must confirm the reason and any reshipping costs.', '/tracking'],
  ['tracking','Tracking','How can I track my shipment?', ['track parcel','tracking status','where is my package','shipment location','track courier'], 'Open Track shipment and enter the ID on your receipt. Live results require the tracking service to be connected. This assistant does not look up shipment status itself.', '/tracking'],
  ['no-updates','Tracking','Why has my tracking stopped updating?', ['tracking not updating','no tracking update','stuck in transit','same tracking status','no movement'], 'Tracking events may appear after the next carrier scan. Check the last event and expected date. If the shipment is overdue, keep the tracking ID ready for a support enquiry.', '/tracking'],
  ['invalid-tracking','Tracking','My tracking number is not working.', ['invalid tracking','tracking not found','tracking number wrong','awb not working','tracking error'], 'Copy the tracking ID exactly from your receipt and check the carrier. If it is still not found, ask the team to verify it. A disconnected tracking service cannot validate a number.', '/tracking'],
  ['tracking-id','Tracking','Where can I find my tracking ID?', ['lost tracking number','find awb','where tracking number','shipment receipt number','no tracking id'], 'Look for the tracking or airway bill number on your shipment receipt or booking confirmation. If unavailable, keep the sender details and shipment date ready for support.', ''],
  ['price','Pricing','How much does courier delivery cost?', ['courier price','shipping cost','delivery charges','courier rate','shipping quote'], 'For international reference rates, choose the destination, documents or parcel, and chargeable weight in Get a quote. The team must confirm the final price and any additional charges.', '/quote'],
  ['domestic-price','Pricing','How much does shipping within India cost?', ['domestic rate','india shipping price','local courier cost','domestic delivery charges','price within india'], 'Domestic prices depend on origin, destination, contents, weight and dimensions. Prepare these details for a quote from the team. The online rate tool currently covers international shipments from India.', '/contact?service=Domestic%20express'],
  ['international-price','Pricing','What are your international courier rates?', ['international rate','overseas shipping price','send abroad cost','foreign courier charges','international shipping quote'], 'Use Get a quote to compare available DHL and UPS reference rates from India. Choose the destination, shipment type and chargeable weight. Unsupported routes require a manual quote.', '/quote'],
  ['weight','Pricing','How is chargeable weight calculated?', ['volumetric weight','dimensional weight','chargeable weight','box dimensions','actual weight'], 'Carriers may charge by actual or volumetric weight. Share length, width, height and actual weight for assessment. The applicable carrier divisor and rounding must be confirmed before pricing.', '/contact?service=Weight%20assessment'],
  ['extra-charges','Pricing','Are there additional charges beyond the estimate?', ['extra charges','fuel surcharge','tax included','hidden fees','additional surcharge'], 'Workbook reference estimates include their all-in values. Other applicable surcharges and destination duties are excluded. Ask the team to confirm the total for your shipment before booking.', '/quote'],
  ['bulk-price','Pricing','Can I get a quote for a large or heavy shipment?', ['bulk rate','heavy cargo price','spot rate','300 kg','bulk shipping discount'], 'Share the route, contents, box count, dimensions and total weight. Heavy shipments and unsupported rate bands need a shipment-specific quote; discounts are confirmed by the team.', '/contact?service=Spot-rate%20enquiry'],
  ['customs-delay','Customs','My shipment is held at customs. What should I do?', ['held at customs','customs delay','clearance pending','customs stuck','customs hold'], 'Check the carrier notice for any requested documents or payment. Keep your tracking ID, invoice and contents description ready. The team can review the requirement; clearance dates cannot be guaranteed.', '/tracking'],
  ['duties','Customs','Who pays customs duty on an international shipment?', ['customs duty','import tax','duty payment','destination taxes','customs fees'], 'Destination duties and taxes depend on the shipment and destination rules. They are excluded from the reference estimate. Confirm the payment responsibility and applicable costs before booking.', '/shipping-notes'],
  ['documents','Customs','What documents do I need for international shipping?', ['export documents','customs paperwork','shipping invoice','kyc documents','commercial invoice'], 'Requirements depend on contents, purpose and destination. Prepare a clear contents list and invoice where applicable. The team will confirm required identity and shipment documents before dispatch.', '/shipping-notes'],
  ['pickup','Pickup','How do I arrange a parcel pickup?', ['book pickup','schedule collection','collect parcel','pickup request','arrange pickup'], 'Open Request a pickup and provide your address, preferred date and shipment details. Collection, pricing and shipment acceptance require team confirmation.', '/pickup'],
  ['pickup-missed','Pickup','My scheduled pickup has not happened.', ['pickup missed','courier did not collect','collection overdue','pickup not arrived','nobody collected','pickup not done','pickup pending','pickup not completed','pickup hasnt happened','pickup not collected','collection not done','collection pending'], 'Keep the pickup request details, agreed date and address ready. Verify whether collection was confirmed. Describe the missed collection if you need the team to investigate.', ''],
  ['pickup-change','Pickup','Can I change or cancel my pickup request?', ['cancel pickup','reschedule pickup','change collection date','postpone pickup','update pickup address'], 'Have your request details and preferred new date ready. Changes or cancellation must be confirmed by the team and depend on whether collection is already arranged.', ''],
  ['packing','Shipping','How should I pack my parcel?', ['packing guidance','pack safely','box packaging','fragile packing','protect contents'], 'Use suitable packaging, cushion contents and secure the box. Keep a contents list and accurate dimensions ready. Fragile or special goods need handling review before acceptance.', '/shipping-notes'],
  ['restricted','Shipping','Can I send restricted or special goods?', ['prohibited items','restricted goods','batteries shipping','liquids shipping','dangerous goods'], 'Acceptance depends on the product, destination and carrier. For dangerous goods, supply classification and a safety data sheet where applicable. A general quote does not confirm acceptance.', '/services/dangerous-goods'],
  ['delivery-time','Shipping','How long will delivery take?', ['delivery time','transit time','how many days','estimated arrival','delivery duration'], 'Transit estimates depend on the route, service and shipment. Share the origin, destination and contents for an estimate. Customs and carrier operations can affect the expected date.', '/contact'],
  ['services','Shipping','Which courier and cargo services do you offer?', ['available services','courier options','service types','dhl ups','shipping services'], 'Royal T offers domestic express, international courier, air cargo, surface cargo and export dangerous goods enquiries. Acceptance and availability are confirmed per shipment.', '/services'],
  ['export-scope','Shipping','Which international routes do you handle?', ['import shipment','send to india','inbound courier','import express','bring goods into india'], 'Our international services cover shipments from India to overseas destinations only. We also handle domestic courier enquiries within India. Share your departure location in India and overseas destination for an export quote.', '/services/international-courier'],
  ['surface','Shipping','Can I ship bulk goods by road?', ['surface cargo','road transport','road freight','bulk goods by road','surface shipment'], 'Surface cargo enquiries cover bulk goods and business inventory within India. Share the route, box count, dimensions and weight for handling and price assessment.', '/services/surface-cargo'],
  ['air','Shipping','Can I book international air cargo?', ['air cargo','air freight','cargo aircraft','international freight','heavy air shipment'], 'Share the cargo dimensions, weight, contents and destination. The team will review routing, handling and export documentation before providing a shipment-specific quote.', '/services/air-cargo'],
  ['refund','Support','How can I request a refund or compensation?', ['refund request','compensation claim','money back','claim reimbursement','refund payment'], 'Keep your receipt, tracking ID and the reason for your request ready. Refunds and compensation require a review of the shipment and applicable terms. This assistant cannot approve a payment.', ''],
  ['billing','Support','There is a problem with my invoice or payment.', ['wrong invoice','charged twice','payment failed','billing error','incorrect bill'], 'Keep the receipt and payment reference ready and describe the discrepancy. Do not enter card details, passwords or banking PINs. The team must verify billing and payment records.', ''],
  ['contact','Support','How do I contact Royal T Courier?', ['contact number','office address','business hours','phone number','contact email'], 'Open Contact for the published contact details. If your question remains unresolved after three attempts here, you can prepare an issue for support.', '/contact'],
  ['complaint','Support','How do I report a courier service complaint?', ['staff complaint','poor service','courier complaint','rude delivery person','service problem'], 'Describe what happened and keep the shipment or pickup reference ready. Try the relevant drafted questions first; after three unsuccessful attempts, this assistant collects an issue and conversation for the team.', ''],
];

export const knowledge = drafts.map(([id, category, question, examples, answer, href]) => ({
  id, category, question, examples: [question, ...examples], answer, href,
}));

const contextWords = {Pickup:'pickup', Delivery:'delivery', Tracking:'tracking', Pricing:'shipping price', Customs:'customs', Shipping:'shipment', Support:'courier service'};
export function classify(text) {
  const values = features(text), logits = [...model.biases];
  for (const [key,value] of values) {
    const weights = model.weights[key];
    if (weights) for (let i = 0; i < logits.length; i++) logits[i] += weights[i] * value;
  }
  if (!logits.length) return [];
  const maximum = Math.max(...logits), exp = logits.map(v => Math.exp(v-maximum)), sum = exp.reduce((a,b) => a+b,0);
  return model.labels.map((id,i) => ({id, confidence:exp[i]/sum})).sort((a,b) => b.confidence-a.confidence);
}
export function matchQuestions(text, limit = 3, context = null) {
  const n = normalize(text);
  if (!n) return [];
  const c = concepts(text);
  if (c.outOfScope) return [];
  // Use the previous topic only for underspecified follow-ups; explicit new topics win.
  const explicit = c.pickup || c.delivery || c.tracking || c.price || c.customs || /\b(?:damage\w*|broken|refund|invoice|battery|batteries|packing|air|road|import\w*)\b/.test(n);
  const contextual = context && !explicit && /\b(?:it|that|this|they|them|same|still|not|cancel|reschedule|waiting|again|pending)\b/.test(n);
  const query = contextual ? `${contextWords[context.category] || ''} ${text}` : text;
  const inferred = concepts(query), predictions = classify(query);
  if (!predictions.length || predictions[0].id === 'unknown') return [];
  const exact = knowledge.find(entry => entry.examples.some(example => normalize(example) === n));
  const wordFeatures = features(query).filter(([key]) => key.startsWith('w:'));
  const coverage = wordFeatures.filter(([key]) => model.weights[key]).length / Math.max(wordFeatures.length,1);
  const specific = c.weight || c.restricted || c.packing || c.refund || c.billing || c.complaint || c.surface || c.air || c.customs || c.pickup || c.tracking;
  if (!exact && coverage < .35 && !(specific && predictions[0].confidence > .75)) return [];
  const ranked = predictions.filter(p => p.id !== 'unknown').map(p => ({...knowledge.find(e => e.id === p.id), score:p.confidence, confidence:p.confidence})).filter(e => {
    if (e.category === 'Pickup' && !inferred.pickup) return false;
    if (inferred.pickup && !inferred.delivery && !inferred.price && e.category === 'Delivery') return false;
    return e.id && (exact?.id === e.id || e.confidence >= .10);
  });
  if (exact) ranked.sort((a,b) => Number(b.id === exact.id)-Number(a.id === exact.id) || b.score-a.score);
  if (!exact && (!ranked.length || ranked[0].confidence < .23)) return [];
  return ranked.filter(e => exact?.id === e.id || e.confidence >= Math.max(.10,ranked[0].confidence * .20)).slice(0,limit);
}

export class AssistantSession {
  constructor() { this.failures = 0; this.stage = 'questions'; this.transcript = []; this.pending = false; this.context = null; this.needsClarification = false; }
  record(role, text) { this.transcript.push({role, text}); }
  ask(text) {
    if (this.stage !== 'questions') return [];
    this.record('customer', text); this.pending = true;
    const matches = matchQuestions(text,3,this.context);
    this.needsClarification = !matches.length && /\b(?:not|pending|waiting|nothing|it|this|that|done|days)\b/.test(normalize(text));
    if (matches[0]?.confidence >= .45) this.context = {category:matches[0].category, id:matches[0].id};
    return matches;
  }
  select(id) { const entry = knowledge.find(e => e.id === id); if (entry) { this.context = {category:entry.category,id}; this.pending = true; this.needsClarification = false; } }
  setCategory(category) { if (contextWords[category]) this.context = {category}; }
  reject() { if (!this.pending || this.stage !== 'questions') return; this.pending = false; this.needsClarification = false; this.failures++; if (this.failures >= 3) this.stage = 'issue'; }
  resolve() { this.pending = false; this.failures = 0; this.context = null; this.needsClarification = false; }
}
