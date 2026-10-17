import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {createRateWorkbook,parseRateWorkbook} from '../rate-workbook.mjs';
import {rateStorage,currentRates} from '../rate-storage.mjs';
import {calculateRate,calculateSelfRate} from '../pricing.js';
const data=JSON.parse(await fs.readFile(new URL('../data/rates.json',import.meta.url)));
const bytes=await createRateWorkbook(data);
test('predefined Excel roundtrip preserves customer prices, mappings and all Self variants',async()=>{
  const parsed=await parseRateWorkbook(bytes);
  assert.equal(parsed.SELF.routes.length,82);
  for(const carrier of ['DHL','UPS'])for(const country of data.countries)for(const kind of ['documents','parcels'])for(const weight of [.5,1,5,20,20.1,30,44.1,299])assert.deepEqual(calculateRate(parsed,carrier,country,kind,weight),calculateRate(data,carrier,country,kind,weight));
  assert.equal(parsed.countries.find(c=>c.name==='Germany').zone,'DE');
  for(const country of ['Ireland, Republic of','Netherlands (Holland)','Tanzania, United Republic of','Monaco (France)','Serbia','Montenegro','Reunion Island'])assert.ok(parsed.SELF.routes.some(r=>r.country===country),country);
});
test('Self rounds weight, applies threshold prices, and preserves unavailable/suspended services',()=>{
  const route=data.SELF.routes.find(r=>r.country==='Singapore');
  for(const [weight,amount,charged]of [[.5,1540,.5],[.51,1980,1],[5.5,5940,5.5],[5.99,2520,6],[6.01,2940,7],[11,4510,11],[26,10660,26]]){const rate=calculateSelfRate(route,weight);assert.equal(rate.amount,amount);assert.equal(rate.chargedWeight,charged);}
  assert.equal(calculateSelfRate(data.SELF.routes.find(r=>r.country==='Kenya'),1).manual,true);
  assert.equal(calculateSelfRate(data.SELF.routes.find(r=>r.country==='Iran'),1).manual,true);
  assert.equal(calculateSelfRate(data.SELF.routes.find(r=>r.country==='Saudi Arabia'),14).manual,true);
  assert.equal(calculateSelfRate(data.SELF.routes.find(r=>r.name==='NEW ZEALAND (AKL)'),26).amount,19500);
});

test('blank expiry dates keep rates valid until replaced while dated lists retain validation',async()=>{
  const open=await parseRateWorkbook(bytes);
  assert.equal(open.validUntil,null);assert.equal(open.SELF.validUntil,null);
  const dated={...data,validUntil:'2026-10-31'};
  assert.equal((await parseRateWorkbook(await createRateWorkbook(dated))).validUntil,'2026-10-31');
  for(const expiry of ['2026-10-01','2026-02-30','not a date']){
    await assert.rejects(parseRateWorkbook(await createRateWorkbook({...data,validUntil:expiry})));
  }
});
test('invalid sheets, formulas, negative values, dates and duplicates cannot be published',async()=>{
  for(const mutate of [b=>b.getWorksheet('Rates').getCell('G2').value=-1,b=>b.getWorksheet('Rates').getCell('G2').value={formula:'1+1',result:2},b=>b.getWorksheet('Settings').getCell('B3').value='2026-02-30',b=>b.getWorksheet('Rates').addRow(b.getWorksheet('Rates').getRow(2).values.slice(1)),b=>b.removeWorksheet('Self'),b=>b.getWorksheet('Rates').getCell('A1').value='changed']){
    const b=new ExcelJS.Workbook();await b.xlsx.load(bytes);mutate(b);await assert.rejects(parseRateWorkbook(Buffer.from(await b.xlsx.writeBuffer())));
  }
  await assert.rejects(parseRateWorkbook(Buffer.from('not an Excel file')));
});
function storage(){
  const files=new Map();let active=null,locked=false,failUpload=false,updatedBy=null;
  const store={async list(){return {data:[...files.keys()].sort().reverse().map(name=>({name,created_at:'2026-10-16'}))};},async upload(path,body){if(failUpload)return {error:{message:'failed'}};files.set(path,body);return {data:{path}};},async download(path){return files.has(path)?{data:new Blob([files.get(path)])}:{error:{}};},async remove(paths){for(const p of paths)files.delete(p);return {data:[]};}};
  const service={storage:{from(){return store;}},from(){return {select(){return this;},eq(){return this;},async single(){return {data:{active_path:active,updated_by:updatedBy}};}};},async rpc(name,args){if(name==='royalt_claim_rate_upload'){if(locked)return {data:false};locked=true;return {data:true};}if(name==='royalt_release_rate_upload')locked=false;if(name==='royalt_publish_rates'){active=args.p_path;updatedBy=args.p_staff;}return {data:true};}};
  return {service,files,get active(){return active;},set failUpload(v){failUpload=v;},set locked(v){locked=v;}};
}
test('publishing four changes retains exactly three Excel files, current prices and authenticated downloads',async()=>{
  const mock=storage();for(let i=0;i<4;i++){await rateStorage(mock.service,{id:'test'},'POST',{action:'upload',name:'rates.xlsx',base64:bytes.toString('base64')});await new Promise(r=>setTimeout(r,2));}
  assert.equal(mock.files.size,3);assert.ok(mock.files.has(mock.active));
  const list=await rateStorage(mock.service,{},'GET');assert.equal(list.files.length,3);assert.equal(list.files.filter(f=>f.active).length,1);
  assert.equal((await currentRates(mock.service)).SELF.routes.length,82);
  const download=await rateStorage(mock.service,{},'POST',{action:'download',path:mock.active});assert.deepEqual(Buffer.from(download.base64,'base64'),bytes);
  const active=mock.active;mock.failUpload=true;await assert.rejects(rateStorage(mock.service,{},'POST',{action:'upload',name:'rates.xlsx',base64:bytes.toString('base64')}));assert.equal(mock.active,active);assert.equal(mock.files.size,3);
  await assert.rejects(rateStorage(mock.service,{},'POST',{action:'download',path:'../private.pdf'}));
  mock.locked=true;await assert.rejects(rateStorage(mock.service,{},'POST',{action:'upload',name:'rates.xlsx',base64:bytes.toString('base64')}),{status:409});
});

test('first public rate read seeds Storage; subsequent staff prices are never replaced by the bundled seed',async()=>{
  const mock=storage();const initial=await currentRates(mock.service);assert.equal(initial.SELF.routes.length,82);assert.equal(mock.files.size,1);
  const changed=structuredClone(data);changed.UPS.documents[0].rates.US=999;
  const updated=await createRateWorkbook(changed);
  await rateStorage(mock.service,{id:'staff'},'POST',{action:'upload',name:'new.xlsx',base64:updated.toString('base64')});
  assert.equal((await currentRates(mock.service)).UPS.documents[0].rates.US,999);assert.equal(mock.files.size,2);
});
