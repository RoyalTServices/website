import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const id='11111111-1111-4111-8111-111111111111';
const record={id,reference:'RT-20261014-1234567890ABCDEF',status:'new',trackingStatus:'pending',name:'Test customer',email:'test@example.com',phone:'9000000000',weight:2,dimensions:{length:10,width:10,height:10},receiver:{},sender:{},shippingCost:60,sellingPrice:100,history:[],updatedAt:'2026-10-14T00:00:00Z'};
async function waitFor(condition){for(let i=0;i<100;i++){if(condition())return;await new Promise(r=>setTimeout(r,5));}throw Error('UI update did not complete.');}
async function mount(role) {
  const window=new Window({url:'https://royalt.test/internal'}),previous={document:globalThis.document,window:globalThis.window,history:globalThis.history,fetch:globalThis.fetch,FormData:globalThis.FormData};
  window.document.body.innerHTML='<div id="internal-app"></div>';Object.assign(globalThis,{document:window.document,window,history:window.history,FormData:window.FormData});const calls=[];
  globalThis.fetch=async(url,options={})=>{const path=new URL(url,'https://royalt.test').pathname;calls.push({path,options});let data={};
    if(path.endsWith('/session'))data={user:{id,email:'staff@example.com',role}};
    else if(path.endsWith('/invite'))data={inviteUrl:'https://royalt.test/internal?token_hash=private-example&type=invite'};
    else if(path.endsWith('/summary'))data={counts:{shipments:1,pending:1,inTransit:0,delivered:0,exceptions:0},recent:[]};
    else if(path.endsWith('/records'))data=options.method==='POST'?{record}:{records:[record],total:1};
    else if(path.endsWith('/records/'+id))data={record};
    else if(path.endsWith('/payments'))data={payments:[{amount:20,status:'paid',method:'UPI'},{amount:5,status:'refunded',method:'UPI'}]};
    else if(path.endsWith('/documents'))data={documents:[]};
    else if(path.endsWith('/events'))data={events:[]};
    else if(path.endsWith('/enquiries'))data={enquiries:[],total:0};
    else if(path.endsWith('/customers'))data={customers:[],total:0};
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  };
  await import('../internal.js?ui='+Math.random());
  return {window,calls,close(){Object.assign(globalThis,previous);window.happyDOM.abort();}};
}
test('staff UI creates bookings, edits package details and opens payment/document/history workflows',async()=>{
  const {window,calls,close}=await mount('staff');const d=window.document;
  try {
    assert.equal(d.querySelector('[data-tab=staff]'),null);assert.match(d.querySelector('.metrics').textContent,/Delayed \/ exception/);
    d.querySelector('#add').click();let f=d.querySelector('dialog form');f.elements.name.value='Test customer';f.elements.phone.value='9000000000';f.elements.message.value='Parcel';f.elements.weight.value='2';f.elements.namedItem('length').value='10';
    f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>d.querySelector('#payments'));
    const booking=JSON.parse(calls.find(c=>c.path.endsWith('/records')&&c.options.method==='POST').options.body);assert.equal(booking.dimensions.length,'10');assert.ok(booking.requestKey);
    f=d.querySelector('dialog form');f.elements.sellingPrice.value='100';f.elements.receiverName.value='Recipient';f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>calls.some(c=>c.options.method==='PATCH'));
    const patch=JSON.parse(calls.find(c=>c.options.method==='PATCH').options.body);assert.equal(patch.receiver.name,'Recipient');assert.equal(patch.updatedAt,record.updatedAt);
    await waitFor(()=>d.querySelector('#payments')&&!d.querySelector('dialog form button').disabled);d.querySelector('#payments').click();await waitFor(()=>d.querySelector('dialog [name=amount]'));assert.match(d.querySelector('dialog').textContent,/85\.00/);
    d.querySelector('dialog [data-close]').click();d.querySelector('[data-tab=shipments]').click();await waitFor(()=>d.querySelector('[data-record]'));d.querySelector('[data-record]').click();await waitFor(()=>d.querySelector('#documents'));d.querySelector('#documents').click();await waitFor(()=>d.querySelector('dialog input[type=file]'));assert.equal(d.querySelector('dialog input[type=file]').accept,'application/pdf');
  } finally {close();}
});
test('admin UI includes the invitation workflow without offering public registration',async()=>{
  const {window,calls,close}=await mount('admin');const d=window.document;
  try {d.querySelector('[data-tab=staff]').click();await waitFor(()=>d.querySelector('#staff-content [name=email]'));const f=d.querySelector('#staff-content form');f.elements.email.value='invited@example.com';f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>calls.some(c=>c.path.endsWith('/invite')));await waitFor(()=>d.querySelector('#staff-invitation'));assert.match(d.querySelector('#staff-invitation').href,/token_hash=private-example/);assert.ok(!calls.some(c=>c.path.endsWith('/setup')));}
  finally {close();}
});
