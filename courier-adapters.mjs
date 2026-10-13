import {createHash,randomUUID} from 'node:crypto';
const key=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const status=value=>{const v=String(value||'').toLowerCase();return /cancel/.test(v)?'cancelled':/delivered|^d$/.test(v)?'delivered':/exception|delay|failure|^x$/.test(v)?'exception':/transit|transferred|out.for.delivery|pickup|^i$|^p$/.test(v)?'in_transit':'unknown';};
const iso=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
export function normalizeDhl(body) {
  const shipment=body.shipments?.[0];if(!shipment)throw Error('Courier tracking is not available yet.');
  const events=(shipment.events||[]).map(e=>({partner:'DHL',id:String(e.id||''),status:status(e.statusCode),description:e.description||e.status||'',location:e.location?.address?.addressLocality||'',timestamp:iso(e.timestamp),localTimestamp:''}));
  for(const e of events)e.key=key([e.partner,e.id,e.status,e.description,e.location,e.timestamp]);
  const current=status(shipment.status?.statusCode),delivered=events.find(e=>e.status==='delivered');
  return {status:current,estimated:shipment.estimatedTimeOfDelivery?.slice(0,10)||null,delivered:delivered?.timestamp||null,events};
}
export function normalizeUps(body) {
  const shipment=body.trackResponse?.shipment?.[0],parcel=shipment?.package?.[0];if(!parcel)throw Error('Courier tracking is not available yet.');
  const events=(parcel.activity||[]).map(e=>({partner:'UPS',id:'',status:status(e.status?.type),description:e.status?.description||'',location:[e.location?.address?.city,e.location?.address?.countryCode].filter(Boolean).join(', '),timestamp:iso(e.gmtDate&&e.gmtTime?`${e.gmtDate.slice(0,4)}-${e.gmtDate.slice(4,6)}-${e.gmtDate.slice(6,8)}T${e.gmtTime.slice(0,2)}:${e.gmtTime.slice(2,4)}:${e.gmtTime.slice(4,6)}Z`:null),localTimestamp:e.date&&e.time?`${e.date.slice(0,4)}-${e.date.slice(4,6)}-${e.date.slice(6,8)} ${e.time.slice(0,2)}:${e.time.slice(2,4)} (courier local time)`:''}));
  for(const e of events)e.key=key([e.partner,e.status,e.description,e.location,e.timestamp||e.localTimestamp]);
  const delivery=parcel.deliveryDate?.[0]?.date;
  return {status:status(parcel.currentStatus?.type||parcel.activity?.[0]?.status?.type),estimated:delivery?`${delivery.slice(0,4)}-${delivery.slice(4,6)}-${delivery.slice(6,8)}`:null,delivered:events.find(e=>e.status==='delivered')?.timestamp||null,events};
}
export function courierAdapters(env=process.env,fetcher=fetch) {
  let upsToken;
  async function json(url,options={}) {const response=await fetcher(url,{...options,signal:AbortSignal.timeout(7000)});if(!response.ok)throw Object.assign(Error('Courier tracking request failed.'),{status:response.status});return response.json();}
  const blocked=async()=>{throw Error('Carrier booking and label retrieval require an approved shipping integration.');};
  return {
    DHL:{configured:Boolean(env.DHL_TRACKING_API_KEY),async track(number){if(!env.DHL_TRACKING_API_KEY)throw Error('DHL tracking is not configured.');return normalizeDhl(await json('https://api-eu.dhl.com/track/shipments?trackingNumber='+encodeURIComponent(number),{headers:{'DHL-API-Key':env.DHL_TRACKING_API_KEY}}));},book:blocked,label:blocked},
    UPS:{configured:Boolean(env.UPS_CLIENT_ID&&env.UPS_CLIENT_SECRET),async track(number){if(!env.UPS_CLIENT_ID||!env.UPS_CLIENT_SECRET)throw Error('UPS tracking is not configured.');const host=env.UPS_ENVIRONMENT==='production'?'https://onlinetools.ups.com':'https://wwwcie.ups.com';
      if(!upsToken||upsToken.expires<Date.now()){const token=await json(host+'/security/v1/oauth/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(env.UPS_CLIENT_ID+':'+env.UPS_CLIENT_SECRET).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});upsToken={value:token.access_token,expires:Date.now()+Number(token.expires_in)*1000-60000};}
      try{return normalizeUps(await json(host+'/api/track/v1/details/'+encodeURIComponent(number),{headers:{Authorization:'Bearer '+upsToken.value,transId:randomUUID(),transactionSrc:'RoyalT'}}));}catch(error){if(error.status===401)upsToken=undefined;throw error;}
    },book:blocked,label:blocked}
  };
}
// Explicit, injected test adapter. Never selected by a production environment flag.
export function mockCourier(result) {return {configured:true,track:async()=>structuredClone(result),book:async()=>({mock:true,reference:'TEST-ONLY'}),label:async()=>({mock:true})};}
