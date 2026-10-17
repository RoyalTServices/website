import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {seller as billingSeller} from './fixtures/billing.mjs';
const id='11111111-1111-4111-8111-111111111111';
const record={id,reference:'RT-20261014-1234567890ABCDEF',status:'new',trackingStatus:'pending',name:'Test customer',email:'test@example.com',phone:'9000000000',weight:2,dimensions:{length:10,width:10,height:10},receiver:{},sender:{},shippingCost:60,sellingPrice:100,history:[],updatedAt:'2026-10-14T00:00:00Z'};
async function waitFor(condition){for(let i=0;i<100;i++){if(condition())return;await new Promise(r=>setTimeout(r,5));}throw Error('UI update did not complete.');}
async function mount(role,{confirmed=false}={}) {
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
    else if(path.endsWith('/rates'))data={files:[{name:'2026-10-16-rates.xlsx',createdAt:'2026-10-16',active:true}]};
    else if(path.endsWith('/business-settings'))data={settings:billingSeller,updatedAt:'2026-10-17T00:00:00Z'};
    else if(path.endsWith('/invoices'))data={invoices:[],total:0};
    else if(path.endsWith('/invoice'))data={invoice:null,settings:billingSeller,settingsUpdatedAt:'2026-10-17T00:00:00Z',shipment:{...record,reference:record.reference,currency:'INR',updated_at:record.updatedAt,selling_price:118,service:'Courier service',booking_status:confirmed?'confirmed':'new',royalt_customers:{name:record.name,billing_address:{address:'Test billing address',stateCode:'27'}}}};
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

test('staff can open Rate list, download the predefined template and select an updated Excel file',async()=>{
  const {window,close}=await mount('staff');const d=window.document;
  try{d.querySelector('[data-tab=rates]').click();await waitFor(()=>d.querySelector('.rate-management'));assert.equal(d.querySelector('.rate-management a[download]').getAttribute('href'),'/assets/royal-t-price-list-template.xlsx');assert.equal(d.querySelector('.rate-management input[type=file]').accept,'.xlsx');assert.match(d.querySelector('#staff-content').textContent,/Self managed/);assert.match(d.querySelector('#staff-content').textContent,/2026-10-16-rates.xlsx/);assert.ok(d.querySelector('#current-template'));}
  finally{close();}
});

test('billing navigation exposes defaults and invoice history while protecting admin-only settings edits',async()=>{
  const {window,calls,close}=await mount('staff');const d=window.document;
  try{
    d.querySelector('[data-tab=business]').click();await waitFor(()=>d.querySelector('.business-settings'));
    assert.ok(d.querySelector('.business-settings fieldset').disabled);assert.equal(d.querySelector('[name=gstin]').value,billingSeller.gstin);
    d.querySelector('[data-tab=invoices]').click();await waitFor(()=>d.querySelector('#find-invoices'));assert.match(d.querySelector('#staff-content').textContent,/No matching invoices/);
    d.querySelector('[data-tab=shipments]').click();await waitFor(()=>d.querySelector('[data-record]'));d.querySelector('[data-record]').click();await waitFor(()=>d.querySelector('#gst-invoice'));
    assert.ok(d.querySelector('[name=status] option[value=confirmed]'));d.querySelector('#gst-invoice').click();await waitFor(()=>d.querySelector('#record-dialog').textContent.includes('Confirm booking first'));
    assert.ok(!calls.some(c=>c.path.endsWith('/invoice')&&c.options.method==='POST'));
  }finally{close();}
});

test('administrator can save validated billing defaults without issuing an invoice',async()=>{
  const {window,calls,close}=await mount('admin');const d=window.document;
  try{d.querySelector('[data-tab=business]').click();await waitFor(()=>d.querySelector('.business-settings'));const f=d.querySelector('.business-settings form');assert.equal(f.querySelector('fieldset').disabled,false);f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>calls.some(c=>c.path.endsWith('/business-settings')&&c.options.method==='POST'));const body=JSON.parse(calls.find(c=>c.path.endsWith('/business-settings')&&c.options.method==='POST').options.body);assert.equal(body.gstin,billingSeller.gstin);assert.equal(body.priceMode,'inclusive');assert.ok(body.updatedAt);}
  finally{close();}
});
test('confirmed booking opens GST form with inclusive prices; preview never allocates an invoice number',async()=>{
  const {window,calls,close}=await mount('staff',{confirmed:true});const d=window.document;
  try{d.querySelector('[data-tab=shipments]').click();await waitFor(()=>d.querySelector('[data-record]'));d.querySelector('[data-record]').click();await waitFor(()=>d.querySelector('#gst-invoice'));d.querySelector('#gst-invoice').click();await waitFor(()=>d.querySelector('#gst-invoice-form'));const f=d.querySelector('#gst-invoice-form');assert.equal(f.elements.priceMode.value,'inclusive');assert.match(d.querySelector('#invoice-totals').textContent,/118/);f.reportValidity=()=>true; /* happy-dom misreports decimal-step validity; calculation validation is tested independently. */ d.querySelector('#preview-gst').click();await waitFor(()=>d.querySelector('.draft-invoice-preview iframe'));assert.match(d.querySelector('.draft-invoice-preview iframe').srcdoc,/PREVIEW ONLY/);assert.ok(!calls.some(c=>c.path.endsWith('/invoice')&&c.options.method==='POST'));}
  finally{close();}
});
