import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateRate } from '../pricing.js';
const data=JSON.parse(fs.readFileSync(new URL('../data/rates.json',import.meta.url)));
const destination=name=>data.countries.find(c=>c.name===name);
test('USA rates match workbook examples, with separate document and parcel values',()=>{
  assert.equal(calculateRate(data,'UPS',destination('United States'),'parcels',1).amount,1887);
  assert.equal(calculateRate(data,'UPS',destination('United States'),'documents',.5).amount,1812);
  assert.ok(Math.abs(calculateRate(data,'DHL',destination('United States'),'documents',1).amount-3434.3702055)<.00001);
  assert.ok(Math.abs(calculateRate(data,'DHL',destination('United States'),'parcels',.5).amount-2965.8274875)<.00001);
});
test('heavy UPS shipments use a manual enquiry instead of broken formula values',()=>{
  for(const weight of [300,301,500,1000])assert.equal(calculateRate(data,'UPS',destination('United States'),'parcels',weight).manual,true);
  assert.equal(calculateRate(data,'UPS',destination('United States'),'parcels',299).amount,699*299);
});
test('fractional weights select the next listed slab and per-kg bands retain precision',()=>{
  assert.equal(calculateRate(data,'UPS',destination('United States'),'parcels',1.01).chargedWeight,1.5);
  const band=data.DHL.bands.find(b=>b.max===500);
  assert.equal(calculateRate(data,'DHL',destination('United States'),'parcels',300.1).amount,Math.round(band.rates.US*301*100)/100);
});
test('DHL uses its own mapping and makes unmapped routes manual',()=>{
  const uk=destination('United Kingdom');
  assert.equal(calculateRate(data,'DHL',uk,'parcels',1).zone,'7');
  assert.equal(calculateRate(data,'DHL',destination('Austria'),'parcels',2).zone,'7');
  assert.equal(calculateRate(data,'DHL',destination('Australia'),'parcels',1).zone,'14');
  assert.equal(calculateRate(data,'DHL',destination('Norfolk Island (Australia)'),'parcels',1).manual,true);
  assert.equal(calculateRate(data,'DHL',destination('American Samoa'),'parcels',1).zone,'9A');
  assert.equal(calculateRate(data,'DHL',destination('American Samoa'),'parcels',1).amount,data.DHL.parcels.find(r=>r.weight===1).rates.CA);
  assert.ok(calculateRate(data,'UPS',destination('Australia'),'parcels',1).amount>0);
});
test('new UPS export mapping retains distinct destination rows and revised special zones',()=>{
  for(const name of ['British Virgin Islands','St. John (US Virgin Islands)','St. Thomas (US Virgin Islands)','U.S. Virgin Islands','Virgin Gorda (British Virgin Islands)'])assert.equal(destination(name).zone,'7A');
  assert.equal(destination('Heligoland (Germany)').zone,'4');
  assert.equal(destination('Germany').zone,'DE');
  assert.equal(destination('Nicaragua').zone,'7');
  assert.equal(new Set(data.countries.map(country=>country.name)).size,data.countries.length);
  assert.equal(calculateRate(data,'DHL',destination('Curacao'),'parcels',1).zone,'10');
  assert.equal(destination('Curacao').dhlCountryCode,'XC');
  const onlyDhl=data.countries.find(country=>country.zone===null);
  assert.ok(onlyDhl);assert.equal(calculateRate(data,'UPS',onlyDhl,'parcels',1).manual,true);
});
test('invalid or out-of-range weights cannot produce a numeric quote',()=>{
  for(const weight of [0,-1,NaN,100000])assert.equal(calculateRate(data,'DHL',destination('United States'),'parcels',weight).manual,true);
});
