import {randomBytes,randomUUID} from 'node:crypto';
export const failure=(message,status=400)=>Object.assign(Error(message),{status});
export const clean=(value,max=3000)=>typeof value==='string'?value.trim().slice(0,max):'';
export const uuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value||'');
export const businessDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Calcutta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const reference=()=>`RT-${businessDate().replaceAll('-','')}-${randomBytes(8).toString('hex').toUpperCase()}`;
export const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export function numeric(value,label,{integer=false,min=0,max=99999999}={}) {
  if(value===''||value===undefined||value===null)return null;
  const n=Number(value);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw failure(`Enter a valid ${label}.`);return n;
}
export function customer(values) {
  const name=clean(values.name,100),email=clean(values.email,150).toLowerCase(),phone=clean(values.phone,30);
  if(!name||(!email&&!phone))throw failure('Enter a name and contact number or email.');
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw failure('Enter a valid email address.');
  if(phone&&!/^[+0-9 ()-]{7,30}$/.test(phone))throw failure('Enter a valid phone number.');
  return {name,email,phone,company:clean(values.company,150),gstin:clean(values.gstin,15),billingAddress:{address:clean(values.billingAddress?.address,500)}};
}
export function requestPayload(values,internal=false) {
  const c=customer(values),type=internal?'booking':values.type;
  if(!['enquiry','quotation','pickup','booking','assistant_issue'].includes(type))throw failure('Choose a valid request type.');
  if(!internal&&values.consent!==true&&values.consent!=='on')throw failure('Please agree to share your request details.');
  if(!internal&&clean(values.website))throw failure('The request could not be accepted.');
  const dimensions={};for(const field of ['length','width','height'])dimensions[field]=numeric(values.dimensions?.[field]??values[field],field,{min:0.01,max:9999});
  const payload={type,service:clean(values.service,100),address:clean(values.address,500),origin:clean(values.origin,120)||'India',destination:clean(values.destination,120),fromPin:clean(values.fromPin,6),toPin:clean(values.toPin,6),kind:clean(values.kind,30),weight:numeric(values.weight,'weight',{min:.001,max:99999}),boxes:numeric(values.boxes,'package count',{integer:true,min:1,max:9999}),dimensions,declaredValue:numeric(values.declaredValue,'declared value'),date:clean(values.date,10),message:clean(values.message||values.contents),carrier:['DHL','UPS','SELF'].includes(values.carrier)?values.carrier:'',selfService:clean(values.selfService,200),consent:!internal,receiver:{name:clean(values.receiver?.name,100),phone:clean(values.receiver?.phone,30),address:clean(values.receiver?.address,500)},trackingId:clean(values.trackingId,80)};
  if(payload.date&&!validDate(payload.date))throw failure('Enter a valid pickup date.');
  if(!internal&&type==='pickup'&&payload.date<businessDate())throw failure('Choose today or a future pickup date.');
  payload.contents=clean(values.contents);payload.intent=clean(values.intent,30);
  payload.referenceEstimate=numeric(values.referenceEstimate,'reference estimate');
  payload.chargedWeight=numeric(values.chargedWeight,'charged weight',{min:.001,max:99999});
  payload.quoteValidUntil=validDate(values.quoteValidUntil)?values.quoteValidUntil:null;
  for(const field of ['fromPin','toPin'])if(payload[field]&&!/^[1-9]\d{5}$/.test(payload[field]))throw failure('Enter valid Indian PIN codes.');
  if(!payload.message)throw failure('Enter your shipment details or enquiry.');
  if(type==='pickup'&&(!c.phone||!payload.address||!payload.date||!payload.destination||!payload.weight))throw failure('Complete your pickup details.');
  if(type==='assistant_issue')payload.transcript=Array.isArray(values.transcript)?values.transcript.slice(-30).map(item=>({role:item.role==='customer'?'customer':'assistant',text:clean(item.text,1000)})):[];
  return {customer:c,payload,key:uuid(values.requestKey)?values.requestKey:randomUUID()};
}
export function publicTracking(shipment,events) {
  const status={pending:'Awaiting dispatch',in_transit:'In transit',delivered:'Delivered',exception:'Delayed or exception',cancelled:'Cancelled',unknown:'Status awaiting confirmation'}[shipment.tracking_status]||'Awaiting dispatch';
  return {reference:shipment.reference,status,partner:shipment.courier_partner||'',estimatedDelivery:shipment.estimated_delivery||'',lastUpdate:shipment.last_tracking_sync||'',location:events.find(event=>event.location)?.location||'',events:events.map(event=>({status:event.description||event.status,location:event.location||'',timestamp:event.event_at||event.local_timestamp||'',localTimestamp:event.local_timestamp||''}))};
}
