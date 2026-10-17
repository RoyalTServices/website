import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {invoiceCalculation} from '../invoice-math.js';
import {seller as billingSeller,input as billingInput} from './fixtures/billing.mjs';
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
  await db.exec(migration);await db.exec(await fs.readFile(new URL('../supabase/migrations/20261013203918_backend_security.sql',import.meta.url),'utf8'));await db.exec(await fs.readFile(new URL('../supabase/migrations/20261016142434_rate_lists.sql',import.meta.url),'utf8'));await db.exec(await fs.readFile(new URL('../supabase/migrations/20261017065608_billing.sql',import.meta.url),'utf8'));return db;
}

test('invoice issue uses confirmed bookings, immutable snapshots, one number per booking and private tables',async()=>{
  const db=await database();try{
    const staff='33333333-3333-4333-8333-333333333333';
    await db.query('insert into auth.users(id) values($1)',[staff]);
    await db.query("insert into public.royalt_staff_profiles(id,email,role) values($1,'test@example.com','staff')",[staff]);
    const customer=(await db.query("insert into public.royalt_customers(name) values('Test Customer') returning id")).rows[0].id;
    const shipment=(await db.query("insert into public.royalt_shipments(reference,customer_id,booking_status) values('RT-INVOICE-TEST',$1,'new') returning id,updated_at",[customer])).rows[0];
    const settings=(await db.query('update public.royalt_business_settings set details=$1 returning updated_at',[billingSeller])).rows[0];
    const snapshot=invoiceCalculation(billingInput,billingSeller);snapshot.booking={reference:'RT-INVOICE-TEST',service:'Courier'};
    const issue='select public.royalt_issue_invoice($1,$2,$3,$4::jsonb,$5) as invoice',args=[shipment.id,shipment.updated_at,settings.updated_at,snapshot,staff];
    await db.exec('set role service_role');await assert.rejects(db.query(issue,args),/Confirm booking/);
    assert.equal((await db.query('select count(*)::int n from public.royalt_invoices')).rows[0].n,0);
    await db.exec('reset role');await db.query("update public.royalt_shipments set booking_status='confirmed' where id=$1",[shipment.id]);
    const updated=(await db.query('select updated_at from public.royalt_shipments where id=$1',[shipment.id])).rows[0].updated_at;args[1]=updated;
    await db.exec('set role service_role');const first=(await db.query(issue,args)).rows[0].invoice;
    assert.match(first.invoice_number,/^RTC\/\d{2}-\d{2}\/00001$/);assert.ok(first.invoice_number.length<=16);assert.equal(first.total_paise,11800);
    assert.deepEqual((await db.query(issue,args)).rows[0].invoice,first);
    assert.equal((await db.query('select count(*)::int n from public.royalt_invoices')).rows[0].n,1);
    await assert.rejects(db.query("update public.royalt_invoices set buyer_name='Changed'"),/permission denied/);
    await db.exec('reset role');const second=(await db.query("insert into public.royalt_shipments(reference,customer_id,booking_status) values('RT-INVOICE-SECOND',$1,'confirmed') returning id,updated_at",[customer])).rows[0];
    await db.exec('set role service_role');await assert.rejects(db.query(issue,[second.id,second.updated_at,'2000-01-01T00:00:00Z',snapshot,staff]),/Billing details changed/);
    const next=(await db.query(issue,[second.id,second.updated_at,settings.updated_at,snapshot,staff])).rows[0].invoice;assert.match(next.invoice_number,/\/00002$/);
    await db.exec('reset role');await assert.rejects(db.query("delete from public.royalt_invoices"),/cannot be edited or deleted/);
    await db.query("update public.royalt_business_settings set details=jsonb_set(details,'{businessName}','\"New name\"')");
    assert.equal((await db.query('select snapshot from public.royalt_invoices')).rows[0].snapshot.seller.businessName,billingSeller.businessName);
    await db.exec('set role authenticated');await assert.rejects(db.query('select * from public.royalt_business_settings'),/permission denied/);await assert.rejects(db.query('select * from public.royalt_invoices'),/permission denied/);await assert.rejects(db.query(issue,args),/permission denied/);
  }finally{await db.close();}
});

test('price publication is serialized and private bucket/publication controls are service-only',async()=>{
  const db=await database();try{
    assert.equal((await db.query("select public from storage.buckets where id='royalt-rate-lists'")).rows[0].public,false);
    await db.exec('set role service_role');
    const token='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
    assert.equal((await db.query('select public.royalt_claim_rate_upload($1::uuid) as ok',[token])).rows[0].ok,true);
    assert.equal((await db.query('select public.royalt_claim_rate_upload($1::uuid) as ok',[other])).rows[0].ok,false);
    await assert.rejects(db.query("select public.royalt_publish_rates($1::uuid,'test.xlsx',null)",[other]));
    await db.query("select public.royalt_publish_rates($1::uuid,'test.xlsx',null)",[token]);
    assert.equal((await db.query('select active_path from public.royalt_rate_state')).rows[0].active_path,'test.xlsx');
    await db.query('select public.royalt_release_rate_upload($1::uuid)',[token]);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from public.royalt_rate_state'));
    await assert.rejects(db.query('select public.royalt_claim_rate_upload($1::uuid)',[other]));
  }finally{await db.close();}
});
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
