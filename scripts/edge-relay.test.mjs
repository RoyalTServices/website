import test from 'node:test';
import assert from 'node:assert/strict';
import {edgeRelay} from '../edge-relay.mjs';
import {applicationApi} from '../application-api.mjs';
import {Readable} from 'node:stream';
const env={SUPABASE_EDGE_URL:'https://example.supabase.co/functions/v1/royalt-api',SUPABASE_PUBLISHABLE_KEY:'public-key'};
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers);},end(body){this.body=JSON.parse(body);}};}
test('relay preserves API route/query, parsed JSON and secure session cookie chunks',async()=>{
  let call;const relay=edgeRelay(env,async(url,options)=>{call={url,options};const headers=new Headers({'Content-Type':'application/json'});headers.append('Set-Cookie','sb-first=value; HttpOnly; Secure');headers.append('Set-Cookie','sb-second=value; HttpOnly; Secure');return new Response('{"ok":true}',{status:201,headers});});
  const res=response();await relay({url:'/api/handler?route=internal/invite&page=2',method:'POST',headers:{cookie:'sb-first=old',origin:'https://royaltservices.in','content-type':'application/json'},body:{email:'staff@example.com'}},res,'/api/internal/invite');
  assert.equal(call.url.pathname,'/functions/v1/royalt-api/internal/invite');assert.equal(call.url.search,'?page=2');assert.equal(call.options.headers.cookie,'sb-first=old');assert.equal(call.options.body,'{"email":"staff@example.com"}');assert.equal(res.headers['Set-Cookie'].length,2);assert.equal(res.status,201);
});
test('relay caps documents and does not expose provider errors or private credentials',async()=>{
  const res=response();await edgeRelay(env,()=>{throw Error('secret')})({url:'/api/requests',method:'POST',headers:{},body:Buffer.alloc(2097153)},res,'/api/requests');assert.equal(res.status,413);
  const failed=response();await edgeRelay(env,()=>{throw Error('private-key')})({url:'/api/internal/session',method:'GET',headers:{}},failed,'/api/internal/session');assert.equal(failed.status,503);assert.ok(!JSON.stringify(failed.body).includes('private-key'));
});
test('production can use the hosted backend without a privileged Vercel key',async()=>{
  const api=applicationApi('.', {VERCEL:'1',VERCEL_ENV:'production'});assert.equal(typeof api,'function');
  const res=response();await api({url:'/api/internal/session',method:'HEAD',headers:{}},res,'/static');assert.equal(res.status,undefined);
});
test('Vercel lazy body helpers cannot corrupt binary PDF bytes',async()=>{
  const pdf=Buffer.concat([Buffer.from('%PDF-1.4\n'),Buffer.from([0,255,128,1])]);
  const req=Readable.from([pdf]);Object.assign(req,{url:'/api/internal/records/example/documents',method:'POST',headers:{'content-type':'application/pdf'}});
  Object.defineProperty(req,'body',{get(){throw Error('Lazy parser must not be accessed');}});
  let sent;const relay=edgeRelay(env,async(url,options)=>{sent=options.body;return new Response('{"ok":true}');});const res=response();
  await relay(req,res,'/api/internal/records/example/documents');assert.deepEqual(sent,pdf);assert.equal(res.status,200);
});
