import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {internalApi} from '../internal-api.mjs';

test('staff setup rejects seven characters and accepts an eight-character password',async()=>{
  const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const store=path.join(root,'.internal-test',`auth-eight-${Date.now()}.json`);
  const previous=process.env.INTERNAL_STORE_PATH;process.env.INTERNAL_STORE_PATH=store;
  const handler=internalApi(root);
  if(previous===undefined)delete process.env.INTERNAL_STORE_PATH;else process.env.INTERNAL_STORE_PATH=previous;
  const server=http.createServer((req,res)=>handler(req,res,new URL(req.url,'http://localhost').pathname));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const send=(route,password)=>fetch(origin+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'test.staff',password})});
  try{
    assert.equal((await send('/api/internal/setup','1234567')).status,400);
    assert.equal((await send('/api/internal/setup','testpass')).status,200);
    assert.equal((await send('/api/internal/login','testpass')).status,200);
  }finally{await new Promise(resolve=>server.close(resolve));await fs.unlink(store);}
});
