import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {internalApi} from '../internal-api.mjs';
test('staff API handles malformed input, missing records, validation, conflicts and storage failures',async()=>{
  const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),store=path.join(root,'.internal-test',`errors-${Date.now()}.json`);
  const previous=process.env.INTERNAL_STORE_PATH;process.env.INTERNAL_STORE_PATH=store;const handler=internalApi(root);if(previous===undefined)delete process.env.INTERNAL_STORE_PATH;else process.env.INTERNAL_STORE_PATH=previous;
  const server=http.createServer((req,res)=>handler(req,res,new URL(req.url,'http://localhost').pathname));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;let cookie='';
  async function call(route,method='GET',value){const response=await fetch(origin+route,{method,headers:{'Content-Type':'application/json',Cookie:cookie},...(value!==undefined?{body:typeof value==='string'?value:JSON.stringify(value)}:{})});const body=await response.json();if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body};}
  try{
    assert.equal((await call('/api/requests','POST','{')).status,400);
    assert.equal((await call('/api/requests','POST',null)).status,400);
    assert.equal((await call('/api/requests','POST',[])).status,400);
    assert.equal((await call('/api/requests','POST','a'.repeat(33000))).status,413);
    assert.equal((await call('/api/internal/records')).status,401);
    assert.equal((await call('/api/internal/setup','POST',{username:'test.staff',password:'testpass'})).status,200);
    assert.equal((await call('/api/internal/setup','POST',{username:'other.staff',password:'testpass'})).status,409);
    assert.equal((await call('/api/internal/records/00000000-0000-0000-0000-000000000000','PATCH',{status:'completed'})).status,404);
    const fields={name:'Example customer',phone:'9000000000',destination:'Austria',message:'Example shipment'};
    assert.equal((await call('/api/internal/records','POST',{...fields,email:'invalid'})).status,400);
    assert.equal((await call('/api/internal/records','POST',{...fields,weight:-1})).status,400);
    assert.equal((await call('/api/internal/records','POST',{...fields,date:'2026-02-30'})).status,400);
    const added=await call('/api/internal/records','POST',fields),record=added.body.record;assert.equal(added.status,201);
    assert.equal((await call('/api/internal/records/'+record.id,'PATCH',{status:'invalid'})).status,400);
    assert.equal((await call('/api/internal/records/'+record.id,'PATCH',{status:'completed',updatedAt:'outdated'})).status,409);
    assert.equal((await call('/api/internal/records')).body.records[0].status,'new');
    assert.equal((await call('/api/internal/records/'+record.id,'PATCH',{status:'in_progress',updatedAt:record.updatedAt,staffNotes:'Saved'})).status,200);
    await fs.writeFile(store,'{broken');const unavailable=await call('/api/internal/records');assert.equal(unavailable.status,500);assert.match(unavailable.body.error,/storage is unavailable/);
  }finally{await new Promise(resolve=>server.close(resolve));await fs.unlink(store);}
});
