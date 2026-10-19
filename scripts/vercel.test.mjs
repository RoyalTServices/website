import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {buildSite} from './build.mjs';
import {auditBuiltSite} from './audit-seo.mjs';
import {publicRoutes} from '../pages.js';
import {requestStore,postgresStore} from '../request-store.mjs';
import {internalApi} from '../internal-api.mjs';
import handler from '../api/handler.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
async function temporary() {const parent=path.join(root,'.internal-test');await fs.mkdir(parent,{recursive:true});return fs.mkdtemp(path.join(parent,'vercel-'));}
async function serve(api) {const server=http.createServer((req,res)=>api(req,res,new URL(req.url,'http://localhost').pathname));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};}

test('production output contains complete routes and SEO but no private workspace files',async()=>{
  const output=await temporary();
  try {
    await buildSite(output,{environment:'production',siteUrl:'https://royaltservices.in'});
    for(const route of publicRoutes) {
      const html=await fs.readFile(path.join(output,route==='/'?'index.html':route.slice(1)+'.html'),'utf8');
      assert.equal((html.match(/<h1\b/g)||[]).length,1,route);
      assert.ok(!html.includes('<!--SEO_HEAD-->'),route);
      assert.match(html,/data-path=/);
    }
    assert.match(await fs.readFile(path.join(output,'services/international-courier.html'),'utf8'),/rel="canonical" href="https:\/\/royaltservices\.in\/services\/international-courier"/);
    assert.match(await fs.readFile(path.join(output,'404.html'),'utf8'),/Page Not Found/);
    assert.match(await fs.readFile(path.join(output,'sitemap.xml'),'utf8'),/https:\/\/royaltservices\.in\/quote/);
    assert.deepEqual(await fs.readdir(path.join(output,'data')),['rates.json']);
    for(const file of ['internal-api.mjs','request-store.mjs','server.mjs','.env','scripts','preview','data/internal-store.json'])await assert.rejects(fs.access(path.join(output,file)));
    const entries=await fs.readdir(output);assert.ok(entries.includes('internal.html')&&entries.includes('assistant-model.js'));
  } finally {await fs.rm(output,{recursive:true,force:true});}
});

test('preview output remains noindex in initial HTML and browser configuration',async()=>{
  const output=await temporary();
  try {
    await buildSite(output,{environment:'preview',siteUrl:'https://royaltservices.in'});
    assert.match(await fs.readFile(path.join(output,'index.html'),'utf8'),/name="robots" content="noindex/);
    assert.match(await fs.readFile(path.join(output,'robots.txt'),'utf8'),/Disallow: \//);
    const js=await fs.readFile(path.join(output,'site-config.js'),'utf8');assert.match(js,/"siteUrl": ""/);
    assert.ok(!((await fs.readFile(path.join(output,'sitemap.xml'),'utf8')).includes('<loc>')));
    await assert.rejects(buildSite(output,{environment:'production',siteUrl:'http://localhost'}),/public HTTPS/);
  } finally {await fs.rm(output,{recursive:true,force:true});}
});

test('generated SEO audit rejects broken page links, missing assets and indexing regressions',async()=>{
  const output=await temporary();
  try {
    await buildSite(output,{environment:'production',siteUrl:'https://royaltservices.in'});
    const file=path.join(output,'index.html'),html=await fs.readFile(file,'utf8');
    await fs.writeFile(file,html.replace('index,follow,max-image-preview:large','noindex,follow').replace('</main>','<a href="/missing-service">Broken service</a><img src="/assets/missing.jpeg" alt="Missing" width="100" height="100"></main>'));
    await assert.rejects(auditBuiltSite(output),error=>error.message.includes('wrong indexing rules') && error.message.includes('/missing-service') && error.message.includes('/assets/missing.jpeg'));
  } finally {await fs.rm(output,{recursive:true,force:true});}
});

test('Vercel never falls back to local customer storage when the database is absent',async()=>{
  const output=await temporary(),store=requestStore(output,{databaseUrl:'',vercel:true});
  try {await assert.rejects(store.read(),{status:503});await assert.rejects(store.mutate(()=>{}),{status:503});assert.deepEqual(await fs.readdir(output),[]);}
  finally {await fs.rm(output,{recursive:true,force:true});}
});

test('staff setup is protected and sessions, logout and login limits survive separate handlers',async()=>{
  const output=await temporary(),storePath=path.join(output,'store.json'),setupKey='test-only-setup-key-with-32-characters';
  const api=()=>internalApi(root,{storage:requestStore(root,{databaseUrl:'',vercel:false,storePath}),vercel:true,setupKey});
  const first=await serve(api()),second=await serve(api());let cookie='';
  async function call(server,route,method='GET',values){const res=await fetch(server.url+route,{method,headers:{'Content-Type':'application/json',Cookie:cookie,'x-vercel-forwarded-for':'192.0.2.1'},...(values===undefined?{}:{body:JSON.stringify(values)})});const data=await res.json();if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return {res,data};}
  const credentials={username:'test.staff',password:'testpass'};
  try {
    assert.equal((await call(first,'/api/internal/session')).data.setupKeyRequired,true);
    assert.equal((await call(first,'/api/internal/setup','POST',credentials)).res.status,403);
    const created=await call(first,'/api/internal/setup','POST',{...credentials,setupKey});assert.equal(created.res.status,200);assert.match(created.res.headers.get('set-cookie'),/; Secure/);
    assert.equal((await call(second,'/api/internal/session')).data.user.username,'test.staff');
    const stored=JSON.parse(await fs.readFile(storePath,'utf8'));assert.ok(!Object.hasOwn(stored.sessions,cookie.split('=')[1]));
    const submitted=await call(second,'/api/requests','POST',{type:'enquiry',name:'Test customer',email:'test@example.com',message:'Test enquiry',consent:true});assert.equal(submitted.res.status,201);
    assert.equal((await call(first,'/api/internal/records')).data.records.length,1);
    assert.equal((await call(second,'/api/internal/logout','POST',{})).res.status,200);
    assert.equal((await call(first,'/api/internal/records')).res.status,401);
    for(let index=0;index<8;index++)assert.equal((await call(index%2?first:second,'/api/internal/login','POST',{...credentials,password:'wrong'})).res.status,401);
    assert.equal((await call(first,'/api/internal/login','POST',credentials)).res.status,429);
  } finally {await first.close();await second.close();await fs.rm(output,{recursive:true,force:true});}
});

test('Vercel rewrite and parsed-body requests reach the existing API validation',async()=>{
  const server=await serve((req,res)=>{if(req.url.includes('parsed'))req.body={type:'enquiry'};return handler(req,res);});
  try {
    const privateApi=await fetch(server.url+'/api/handler?route=internal/records');assert.equal(privateApi.status,401);assert.match(privateApi.headers.get('x-robots-tag'),/noindex/);
    const badBody=await fetch(server.url+'/api/handler?route=requests&parsed=1',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(badBody.status,400);
    const invalid=await fetch(server.url+'/api/handler?route=../data/internal-store.json');assert.equal(invalid.status,404);
  } finally {await server.close();}
});

test('database mutations use a locked transaction and rollback without exposing connection errors',async()=>{
  const queries=[];let fail=false,released=0;
  const client={async query(sql,params){queries.push({sql,params});if(sql.startsWith('SELECT'))return {rows:[{data:{admin:null,records:[],sessions:{},attempts:{}}}]};if(fail&&sql.startsWith('UPDATE'))throw Object.assign(Error('Private connection details'),{code:'08006'});return {rows:[]};},release(){released++;}};
  const pool={async query(){return {rows:[]};},async connect(){return client;}};
  const store=postgresStore(pool);
  await store.mutate(data=>{data.records.push({id:'test'});});
  assert.ok(queries.some(q=>q.sql.endsWith('FOR UPDATE')));assert.equal(queries.at(-1).sql,'COMMIT');
  const update=queries.find(q=>q.sql.startsWith('UPDATE'));assert.equal(JSON.parse(update.params[0]).records[0].id,'test');
  fail=true;await assert.rejects(store.mutate(()=>{}),error=>error.status===503&&!error.message.includes('Private connection'));
  assert.equal(queries.at(-1).sql,'ROLLBACK');assert.equal(released,2);
});
