import test from 'node:test';
import assert from 'node:assert/strict';
import {businessDetails,validGstin,invoiceCalculation} from '../invoice-math.js';
import {invoiceHtml,amountInWords} from '../invoice-print.js';
import {billingApi} from '../billing-api.mjs';
import {seller,input} from './fixtures/billing.mjs';
test('GST validation checks checksum, supplier state, mandatory details and approved defaults',()=>{
  assert.ok(validGstin(seller.gstin));assert.equal(validGstin('27AAPFU0939F1ZA'),false);
  assert.deepEqual(businessDetails(seller),seller);
  for(const patch of [{gstin:''},{stateCode:'37'},{sac:''},{defaultTaxRate:''},{invoicePrefix:'TOOLONG'},{priceMode:'guess'},{address:''},{defaultTaxRate:101}])assert.throws(()=>businessDetails({...seller,...patch}));
});
test('GST-inclusive intra-state and GST-exclusive interstate invoices calculate paise correctly',()=>{
  const local=invoiceCalculation(input,seller);assert.equal(local.totals.taxablePaise,10000);assert.equal(local.totals.cgstPaise,900);assert.equal(local.totals.stateTaxPaise,900);assert.equal(local.totals.totalPaise,11800);assert.equal(local.localTax,'SGST');
  const interstate=invoiceCalculation({...input,placeOfSupply:'36',priceMode:'exclusive',items:[{...input.items[0],rate:'100'}]},seller);
  assert.equal(interstate.localTax,null);assert.equal(interstate.totals.igstPaise,1800);assert.equal(interstate.totals.totalPaise,11800);
  const discounted=invoiceCalculation({...input,items:[{...input.items[0],discount:'18'}]},seller);assert.equal(discounted.totals.roundOffPaise,-1);assert.equal(discounted.totals.totalPaise,10000);
  const quantity=invoiceCalculation({...input,items:[{...input.items[0],quantity:'2.5'}]},seller);assert.equal(quantity.totals.totalPaise,29500);
});
test('union-territory supplies use CGST plus UTGST',()=>{
  const gstin=[...'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(c=>'04AAPFU0939F1Z'+c).find(validGstin);
  const result=invoiceCalculation({...input,buyerStateCode:'04',placeOfSupply:'04'},{...seller,stateCode:'04',gstin});assert.equal(result.localTax,'UTGST');assert.equal(result.totals.cgstPaise,900);assert.equal(result.totals.stateTaxPaise,900);
});
test('LUT/export and reverse charge use explicit treatment; a parcel destination never selects a tax exemption',()=>{
  const exp=invoiceCalculation({...input,buyerStateCode:'99',buyerCountry:'Singapore',placeOfSupply:'99',treatment:'export_lut',lutReference:'TEST-LUT',items:[{...input.items[0],rate:'100',gstRate:'0'}]},seller);
  assert.equal(exp.totals.totalPaise,10000);assert.equal(exp.totals.taxPaise,0);
  assert.throws(()=>invoiceCalculation({...input,treatment:'export_lut'},seller));
  assert.throws(()=>invoiceCalculation({...input,placeOfSupply:'99'},seller));
  const rcm=invoiceCalculation({...input,buyerGstin:seller.gstin,reverseCharge:'yes',priceMode:'exclusive',items:[{...input.items[0],rate:'100'}]},seller);assert.equal(rcm.totals.taxPaise,1800);assert.equal(rcm.totals.totalPaise,10000);
  assert.throws(()=>invoiceCalculation({...input,reverseCharge:'yes'},seller));
});
test('invalid money, over-discounts, empty invoices, tax rates and inconsistent GST identifiers are rejected',()=>{
  for(const patch of [{rate:'-1'},{rate:'100.001'},{quantity:'0'},{quantity:'1e3'},{discount:'99999'},{gstRate:'101'},{sac:'123'}])assert.throws(()=>invoiceCalculation({...input,items:[{...input.items[0],...patch}]},seller));
  for(const patch of [{items:[]},{items:Array(26).fill(input.items[0])},{buyerGstin:seller.gstin,buyerStateCode:'36'},{placeOfSupply:''},{buyerAddress:''}])assert.throws(()=>invoiceCalculation({...input,...patch},seller));
});
test('printed invoices escape all customer data, preserve totals and show statutory fields and print layout',()=>{
  const snapshot=invoiceCalculation({...input,buyerName:'<script>alert(1)</script>'},seller);snapshot.booking={reference:'RT-TEST',service:'Courier',origin:'India',destination:'Singapore'};
  const html=invoiceHtml({invoice_number:'RTC/26-27/00001',issued_date:'2026-10-17',financial_year:'2026-27',snapshot});
  for(const text of ['TAX INVOICE','ORIGINAL FOR RECIPIENT','RTC/26-27/00001','27AAPFU0939F1ZV','CGST','SGST','118.00','Authorised signatory','@page{size:A4'])assert.ok(html.includes(text),text);
  assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.equal(amountInWords(11800),'Rupees One Hundred Eighteen Only');assert.equal(amountInWords(125050),'Rupees One Thousand Two Hundred Fifty and Fifty Paise Only');
  assert.match(invoiceHtml({snapshot},{draft:true}),/PREVIEW ONLY/);
});
test('billing defaults cannot be changed by staff; unconfirmed bookings cannot be issued',async()=>{
  let queried=false;await assert.rejects(billingApi({}, {role:'staff'}, {method:'POST'},'/api/internal/business-settings',new URL('https://test'),async()=>{queried=true;}),{status:403});assert.equal(queried,false);
  const service={from(table){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:table==='royalt_invoices'?null:{id:'11111111-1111-4111-8111-111111111111',booking_status:'new',updated_at:'now',royalt_customers:{}}};},async single(){return {data:{details:seller,updated_at:'now'}};}};}};
  await assert.rejects(billingApi(service,{role:'staff'},{method:'POST'},'/api/internal/records/11111111-1111-4111-8111-111111111111/invoice',new URL('https://test'),async()=>input),{status:409});
});
