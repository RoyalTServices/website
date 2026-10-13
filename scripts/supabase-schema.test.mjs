import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const migration=await fs.readFile(new URL('../supabase/migrations/20261013194907_royal_t_backend.sql',import.meta.url),'utf8');
async function database() {
  const db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create schema storage;
    create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.uid',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt',true),''),'{}')::jsonb$$;
    grant usage on schema auth to authenticated, service_role;grant execute on all functions in schema auth to authenticated, service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated, service_role;grant select on storage.objects to authenticated;grant all on all tables in schema storage to service_role;`);
  await db.exec(migration);await db.exec(await fs.readFile(new URL('../supabase/migrations/20261013203918_backend_security.sql',import.meta.url),'utf8'));return db;
}
test('migration executes in PostgreSQL; public intake is atomic and retries keep one reference',async()=>{
  const db=await database();try {
    await db.exec('set role service_role');
    const params=[{name:'Example customer',email:'customer@example.com'}, {type:'pickup',message:'Parcel',weight:1,destination:'Hyderabad',date:'2026-10-15'},'RT-20261014-1234567890ABCDEF','11111111-1111-4111-8111-111111111111'];
    const query='select public.royalt_submit_request($1::jsonb,$2::jsonb,$3,$4::uuid) as reference';
    assert.equal((await db.query(query,params)).rows[0].reference,params[2]);
    assert.equal((await db.query(query,[...params.slice(0,2),'different-ref',params[3]])).rows[0].reference,params[2]);
    assert.equal((await db.query('select count(*)::int as n from public.royalt_shipments')).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int as n from public.royalt_customers')).rows[0].n,1);
    const id=(await db.query('select id from public.royalt_shipments')).rows[0].id;
    const event={partner:'DHL',key:'event-one',status:'delivered',description:'Delivered',timestamp:'2026-10-15T10:00:00Z',location:'Hyderabad'};
    const update='select public.royalt_apply_tracking($1::uuid,$2,$3::date,$4::timestamptz,$5::jsonb)';
    await db.query(update,[id,'delivered',null,event.timestamp,[event]]);await db.query(update,[id,'delivered',null,event.timestamp,[event]]);
    assert.equal((await db.query('select count(*)::int as n from public.royalt_tracking_events')).rows[0].n,1);
    assert.equal((await db.query('select booking_status from public.royalt_shipments')).rows[0].booking_status,'completed');
    assert.equal((await db.query("select public.royalt_rate_limit('test',1,60) as allowed")).rows[0].allowed,true);
    assert.equal((await db.query("select public.royalt_rate_limit('test',1,60) as allowed")).rows[0].allowed,false);
    assert.equal((await db.query('select public.royalt_claim_sync() as claimed')).rows[0].claimed,true);
    assert.equal((await db.query('select public.royalt_claim_sync() as claimed')).rows[0].claimed,false);
    await db.query('select public.royalt_release_sync()');
  } finally {await db.close();}
});
test('RLS blocks public/nonstaff access and role escalation; revoked sessions lose business access',async()=>{
  const db=await database();const staff='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333',session='44444444-4444-4444-8444-444444444444';
  try {
    await db.query('insert into auth.users(id) values($1),($2)',[staff,outsider]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,staff]);
    await db.query("insert into public.royalt_staff_profiles(id,email,role) values($1,'staff@example.com','staff')",[staff]);
    await db.query("insert into public.royalt_customers(name) values('Private customer')");
    await db.exec('set role anon');await assert.rejects(db.query('select * from public.royalt_customers'),/permission denied/);await assert.rejects(db.query("select public.royalt_rate_limit('key',1,1)"),/permission denied/);
    await db.exec('reset role');await db.query("select set_config('request.uid',$1,false)",[outsider]);await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.royalt_customers')).rows.length,0);
    await assert.rejects(db.query("insert into public.royalt_staff_profiles(id,email,role) values($1,'x@example.com','admin')",[outsider]),/permission denied/);
    await db.exec('reset role');await db.query("select set_config('request.uid',$1,false)",[staff]);await db.query("select set_config('request.jwt',$1,false)",[JSON.stringify({session_id:session})]);await db.exec('set role authenticated');
    assert.equal((await db.query('select public.royalt_staff_access() as active')).rows[0].active,true);
    assert.equal((await db.query('select * from public.royalt_customers')).rows.length,1);
    await assert.rejects(db.query("update public.royalt_staff_profiles set role='admin' where id=$1",[staff]),/permission denied/);
    const customer=(await db.query('select id from public.royalt_customers')).rows[0].id;
    const enquiry=(await db.query("insert into public.royalt_enquiries(reference,customer_id,type,payload) values('RT-20261014-ABCDEF1234567890',$1,'quotation','{\"weight\":2,\"message\":\"Parcel\"}') returning id",[customer])).rows[0].id;
    const shipment=(await db.query('select public.royalt_convert_enquiry($1) as id',[enquiry])).rows[0].id;
    assert.equal((await db.query('select public.royalt_convert_enquiry($1) as id',[enquiry])).rows[0].id,shipment);
    const current=(await db.query('select updated_at from public.royalt_shipments where id=$1',[shipment])).rows[0].updated_at;
    assert.equal((await db.query('select public.royalt_update_shipment($1,$2,$3) as changed',[shipment,current,{selling_price:100,reference:'attempted-change'}])).rows[0].changed,true);
    assert.equal((await db.query('select reference from public.royalt_shipments where id=$1',[shipment])).rows[0].reference,'RT-20261014-ABCDEF1234567890');
    assert.equal((await db.query('select public.royalt_update_shipment($1,$2,$3) as changed',[shipment,'2000-01-01T00:00:00Z',{selling_price:1}])).rows[0].changed,false);
    assert.equal((await db.query('select count(*)::int as n from public.royalt_activity where shipment_id=$1',[shipment])).rows[0].n,2);
    await db.exec('reset role');await db.query('delete from auth.sessions where id=$1',[session]);await db.exec('set role authenticated');
    assert.equal((await db.query('select public.royalt_staff_access() as active')).rows[0].active,false);
    assert.equal((await db.query('select * from public.royalt_customers')).rows.length,0);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('royalt-documents','unauthorized.pdf')"),/permission denied/);
  } finally {await db.close();}
});
