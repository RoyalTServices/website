// Shared feature extraction for training and inference: retain negation and intent context.
const spellingAnchors = ['pickup','collection','delivery','tracking','courier','customs','package','parcel','damage','damaged','refund','invoice','price','quote','weight','reschedule','cancel','received','battery','address'];
function oneEdit(a,b) {
  if (Math.abs(a.length-b.length) > 1) return false;
  if (a.length === b.length) {
    const differences = [...a].map((letter,i) => letter === b[i] ? -1 : i).filter(i => i >= 0);
    return differences.length === 1 || (differences.length === 2 && differences[1] === differences[0]+1 && a[differences[0]] === b[differences[1]] && a[differences[1]] === b[differences[0]]);
  }
  const longer = a.length > b.length ? a : b, shorter = a.length > b.length ? b : a;
  for (let i=0;i<longer.length;i++) if (longer.slice(0,i)+longer.slice(i+1) === shorter) return true;
  return false;
}
export function normalize(text) {
  return String(text).toLowerCase().replace(/['’]/g, '')
    .replace(/\b(?:hasnt|havent|hadnt|isnt|arent|wasnt|werent|didnt|dont|doesnt|cannot|cant|wont)\b/g, 'not')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\bpick(?:ing|ed)?\s+up\b/g, 'pickup')
    .replace(/\b(?:pick|pickups)\b/g, 'pickup').replace(/\s+/g, ' ').trim()
    .split(' ').map(word => word.length >= 5 && !spellingAnchors.includes(word) ? spellingAnchors.find(anchor => oneEdit(word,anchor)) || word : word).join(' ');
}
const stop = new Set('a an the my our your i we it is was are been be to of for in on at and or can do how what why with me please still since this that someone says yet have has had you need want get give tell could would should so just really now'.split(' '));
const synonyms = {
  parcels:'parcel',package:'parcel',packages:'parcel',consignment:'parcel',consignments:'parcel',shipment:'parcel',shipments:'parcel',box:'parcel',carton:'parcel',
  collected:'collection',collect:'collection',collecting:'collection',pickup:'collection',collection:'collection',
  shipping:'ship',sending:'ship',send:'ship',sent:'ship',postage:'ship',
  pricing:'price',prices:'price',cost:'price',costs:'price',rate:'price',rates:'price',quote:'price',quotation:'price',charges:'price',fees:'price',
  delayed:'late',overdue:'late',delay:'late',arrival:'arrive',arrived:'arrive',reached:'arrive',delivered:'delivery',delivry:'delivery',delvery:'delivery',
  overseas:'international',abroad:'international',foreign:'international',local:'domestic',
  damaged:'damage',broken:'damage',crushed:'damage',smashed:'damage',cracked:'damage',ruined:'damage',
  tracking:'track',tracker:'track',tracked:'track',updates:'update',updating:'update',updated:'update',scans:'scan',events:'scan',
  cancelling:'cancel',cancellation:'cancel',cancelled:'cancel',rescheduled:'reschedule',rescheduling:'reschedule',
  duties:'duty',taxes:'tax',documents:'document',packaging:'packing',batteries:'battery',liquids:'liquid',
  reimbursed:'refund',reimburse:'refund',reimbursement:'refund',refunded:'refund',refunds:'refund',
  padded:'packing',padding:'packing',wrap:'packing',wrapping:'packing',cushion:'packing',cushioning:'packing',
  cells:'battery',hazardous:'dangerous',permitted:'allowed',impolite:'rude',complain:'complaint',
  fails:'failed',rejected:'invalid',unrecognised:'invalid',unrecognized:'invalid',recognise:'recognize',
};
export function terms(text) { return normalize(text).split(' ').filter(w => w && !stop.has(w)).map(w => synonyms[w] || w); }

export function concepts(text) {
  const n = normalize(text), t = terms(text), has = regex => regex.test(n);
  return {
    pickup: has(/\b(?:pickup|collect\w*|door collection)\b/) || has(/\b(?:driver|person|someone|one|nobody|man|rider|agent)\b.*\b(?:came|come|arrive|arrived|shown|showed|take)\b/),
    delivery: has(/\b(?:deliver\w*|delivry|delvery|receiv\w*|recipient|arriv\w*|reach\w*)\b/),
    tracking: t.includes('track') || has(/\b(?:awb|airway bill|consignment number|shipment id)\b/),
    price: t.includes('price') || has(/\bhow much\b/),
    international: t.includes('international') || has(/\b(?:usa|us|uk|canada|germany|australia|dubai|london|america|singapore|france)\b/),
    domestic: t.includes('domestic') || has(/\b(?:hyderabad|delhi|mumbai|chennai|bangalore|bengaluru|within india|inside india|indian destination)\b/),
    customs: has(/\b(?:customs|clearance|border|duty|duties)\b/),
    negative: has(/\b(?:not|no|never|nobody|nothing|without|failed|missing|incomplete|pending|late|overdue|stuck|waiting|missed|same|frozen|lost|absent)\b/) || has(/\bstill (?:at|in) (?:my |the )?(?:house|home|office)\b/),
    change: has(/\b(?:cancel\w*|reschedul\w*|postpone\w*|change|shift|move|update|correct|redirect|fix|stop)\b/),
    booking: has(/\b(?:book|booking|arrange|schedule|request)\b/),
    completionClaim: has(/\b(?:says?|shows?|claims?|marked|status|app|tracking|tracker|reports?)\b.*\b(?:delivered|delivery completed)\b/) || has(/\bdelivered\b.*\bstatus\b/),
    lostParcel: has(/\b(?:lost|disappeared|vanished|missing|cannot locate|not be located|not locate)\b/) && !has(/\b(?:contents|inside|items?|tracking|awb|reference|receipt|code|number)\b/),
    missingContents: has(/\b(?:contents|inside|items?|empty|seal|tampered|removed|only|half)\b/) && has(/\b(?:missing|gone|removed|empty|opened|tampered|only|half|not contain|not received)\b/),
    damage: t.includes('damage') || has(/\b(?:torn|wet|pieces)\b/),
    deliveryAttempt: has(/\b(?:redelivery|absent|unavailable|not home|nobody was home|away|attempt\w*|missed delivery)\b/),
    returned: has(/\b(?:returned|returning|return|rto|back to|going back|heading back|way back|sent back)\b/),
    trackingFailure: has(/\b(?:invalid|error|not work|failed|fails|reject\w*|no results|not recogni\w*|not found|not find)\b/),
    trackingCode: has(/\b(?:lost|misplaced|retrieve|recover|obtain|where|which|no|not know|not find)\b/) && has(/\b(?:number|code|reference|receipt|awb)\b/),
    trackingStale: has(/\b(?:scan|event\w*|update\w*|movement|frozen|stuck|transit|same|old)\b/) && has(/\b(?:not|no|same|stuck|frozen|days|week|old)\b/),
    packing: t.includes('packing') || has(/\b(?:bubble wrap|protect|seal|padding|cushion|wrap|safely|suitable box|kind of box)\b/),
    restricted: has(/\b(?:battery|batteries|lithium|cells|liquids?|perfume|hazardous|dangerous|chemicals?|prohibited|restricted)\b/),
    weight: has(/\b(?:weight|kilos|dimensions?|length|width|height|divisor|volumetric|dimensional|scale|billable|volume or actual)\b/),
    bulk: has(/\b(?:bulk|discount|spot|heavy|volumes|high volume|many|large consignment)\b/) || has(/\b[3-9]\d{2,}\s*(?:kg|kilos|kilograms)\b/),
    refund: t.includes('refund') || has(/\b(?:compensation|claim|money back|payment back|eligible)\b/),
    billing: has(/\b(?:invoice|bill|payment|debit\w*|charged|transaction|billed)\b/) && has(/\b(?:wrong|error|incorrect|duplicate|twice|two times|failed|different|not match|unpaid|correct)\b/),
    paperwork: has(/\b(?:paperwork|documents?|papers|kyc|identity|commercial invoice)\b/) && has(/\b(?:need\w*|require\w*|prepare|which|provide|proof|before|accompany|invoice)\b/),
    complaint: has(/\b(?:complain\w*|rude|impolite|badly|poor service|unacceptable|unhappy|behaved)\b/),
    contact: has(/\b(?:phone|telephone|call|email|office|hours|open|close|contact|reach your support)\b/),
    surface: has(/\b(?:road|surface|truck|lorry|overland)\b/),
    air: has(/\b(?:air|plane|aircraft|flight)\b/),
    imports: has(/\b(?:imports?|inbound|incoming|into india|to india|abroad for delivery in india)\b/),
    services: has(/\b(?:kinds|types|options|services|both|which carrier)\b/),
    outOfScope: has(/\b(?:astronomy|stars|poem|weather|homework|algebra|joke|movie|salary|password|hotel|reservation|game|dog|dinner|food|restaurant|bus|train|repaired|repair)\b/) || has(/\b(?:price|cost) of (?:a |the )?(?:mobile|laptop|phone)\b/) || (has(/\b(?:computer|car)\b/) && !has(/\b(?:ship\w*|courier|parcel|cargo|export|import)\b/)),
  };
}
export function features(text) {
  const words = terms(text), result = new Map();
  const add = (key, value = 1) => result.set(key, Math.max(result.get(key) || 0, value));
  words.forEach(w => add(`w:${w}`));
  for (let i = 1; i < words.length; i++) add(`b:${words[i-1]}_${words[i]}`);
  for (const word of words.filter(w => w.length >= 5)) for (let i = 0; i < word.length - 2; i++) add(`c:${word.slice(i,i+3)}`, .2);
  const c = concepts(text);
  for (const [key, present] of Object.entries(c)) if (present) add(`s:${key}`, 3);
  if (c.pickup && c.negative) add('s:pickup_problem', 3);
  if (c.pickup && c.change) add('s:pickup_change', 3);
  if (c.delivery && c.negative) add('s:delivery_problem', 2);
  if (c.completionClaim && c.negative) add('s:delivery_disputed', 3);
  if (c.price && c.international) add('s:international_price', 3);
  if (c.price && c.domestic) add('s:domestic_price', 3);
  const norm = Math.sqrt([...result.values()].reduce((sum,v) => sum + v*v, 0)) || 1;
  return [...result].map(([key,value]) => [key,value / norm]);
}
