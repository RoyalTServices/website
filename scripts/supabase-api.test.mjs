import test from 'node:test';
import assert from 'node:assert/strict';
import {requestPayload,publicTracking} from '../business-validation.mjs';
import {normalizeDhl,normalizeUps,mockCourier,courierAdapters} from '../courier-adapters.mjs';
import {supabaseApi} from '../supabase-api.mjs';
import {supabaseClients} from '../supabase-client.mjs';

function res(){return {status:null,headers:{},setHeader(k,v){this.headers[k]=v;},getHeader(k){return this.headers[k];},writeHead(n,h){this.status=n;Object.assign(this.headers,h);},end(text){this.data=JSON.parse(text);}};}
const req=(method='GET',body)=>({method,url:'/',headers:{'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'},body});
test('intake retains quote, package and receiver fields but rejects bad values and honeypot submissions',()=>{
  const v={type:'booking',name:'Test',phone:'9000000000',message:'Parcel',weight:2,boxes:1,consent:true,fromPin:'500001',destination:'Austria',receiver:{name:'Recipient',address:'Destination address'},length:10};
  const values=requestPayload(v);assert.equal(values.payload.dimensions.length,10);assert.equal(values.payload.receiver.name,'Recipient');assert.equal(values.payload.fromPin,'500001');
  for(const patch of [{consent:false},{weight:-1},{date:'2026-02-30'},{boxes:1.5},{website:'spam'},{fromPin:'123'}])assert.throws(()=>requestPayload({...v,...patch}));
});
test('tracking projection cannot expose contacts, addresses, payments or internal notes',()=>{
  const output=publicTracking({reference:'RT-TEST',tracking_status:'pending',email:'private',sender:{address:'private'},staff_notes:'private',selling_price:100},[]);
  assert.equal(output.status,'Awaiting dispatch');assert.ok(!JSON.stringify(output).includes('private'));assert.equal(output.events.length,0);
});
test('provider normalization deduplicates consistently without guessing local timezones',async()=>{
  const dhl={shipments:[{status:{statusCode:'delivered'},events:[{statusCode:'delivered',timestamp:'2026-10-14T10:00:00Z',description:'Delivered',location:{address:{addressLocality:'Hyderabad'}}}]}]};
  const first=normalizeDhl(dhl);assert.equal(first.status,'delivered');assert.equal(first.events[0].key,normalizeDhl(dhl).events[0].key);
  const ups=normalizeUps({trackResponse:{shipment:[{package:[{activity:[{status:{type:'I',description:'In transit'},date:'20261014',time:'140000'}]}]}]}});
  assert.equal(ups.status,'in_transit');assert.equal(ups.events[0].timestamp,null);assert.match(ups.events[0].localTimestamp,/courier local time/);
  assert.deepEqual(await mockCourier(first).track('test'),first);await assert.rejects(courierAdapters({}).DHL.book(),/approved shipping integration/);
});
test('cron authorization and unauthenticated staff checks happen before accessing privileged clients',async()=>{
  let called=0;const handler=supabaseApi({env:{CRON_SECRET:'x'.repeat(32)},clients(){called++;throw Error('Unexpected access');}});
  const cron=res();await handler(req('POST',{}),cron,'/api/cron/tracking');assert.equal(cron.status,401);
  const staff=res();await handler(req(),staff,'/api/internal/records');assert.equal(staff.status,401);assert.equal(called,0);
  assert.throws(()=>supabaseClients(req(),res(),{}),{status:503});
});
test('nonstaff users cannot use server-side document, payment or invitation operations',async()=>{
  let writes=0;const handler=supabaseApi({clients:()=>({staff:{auth:{getUser:async()=>({data:{user:{id:'test'}}})},rpc:async()=>({data:false})},service:{from(){writes++;throw Error('Forbidden');}}})});
  const request=req('POST',{});request.headers.cookie='sb-test-auth-token=present';
  for(const route of ['/api/internal/business-settings','/api/internal/invoices','/api/internal/records/11111111-1111-4111-8111-111111111111/invoice','/api/internal/rates','/api/internal/invite','/api/internal/records/11111111-1111-4111-8111-111111111111/payments','/api/internal/records/11111111-1111-4111-8111-111111111111/documents']){const response=res();await handler(request,response,route);assert.equal(response.status,403);}
  assert.equal(writes,0);
});

test('hourly sync calls tracking adapters, persists normalized events and releases its lock',async()=>{
  const writes=[],rpc=[];
  const service={rpc:async(name,args)=>{rpc.push({name,args});return {data:name==='royalt_claim_sync'?true:null};},from(table){let operation='select';const q={select(){return q;},insert(){operation='insert';return q;},update(value){operation='update';writes.push({table,value});return q;},single(){return q;},eq(){return q;},in(){return q;},not(){return q;},neq(){return q;},lte(){return q;},order(){return q;},limit(){return q;},then(resolve){return Promise.resolve({data:table==='royalt_courier_partners'?[{code:'DHL',integration_status:'unconfigured'}]:table==='royalt_shipments'&&operation==='select'?[{id:'test-shipment',courier_partner:'DHL',external_tracking_number:'test-only',sync_failures:0}]:operation==='insert'?{id:'test-run'}:[]}).then(resolve);}};return q;}};
  const normalized={status:'delivered',estimated:null,delivered:'2026-10-14T10:00:00Z',events:[{key:'one',status:'delivered'}]};
  const handler=supabaseApi({env:{CRON_SECRET:'a'.repeat(32)},clients:()=>({service}),adapters:{DHL:mockCourier(normalized)}});
  const request=req('POST',{});request.headers.authorization='Bearer '+'a'.repeat(32);const response=res();await handler(request,response,'/api/cron/tracking');
  assert.equal(response.status,200);assert.deepEqual(response.data,{processed:1,failed:0});assert.equal(rpc.find(r=>r.name==='royalt_apply_tracking').args.p_status,'delivered');assert.equal(rpc.at(-1).name,'royalt_release_sync');assert.equal(writes.find(w=>w.table==='royalt_sync_runs').value.processed,1);
});
