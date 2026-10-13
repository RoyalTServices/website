import fs from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {reference,requestPayload,uuid} from '../business-validation.mjs';

// Dry-run by default. No passwords, sessions or contacts are printed or copied to Auth.
const file=process.env.INTERNAL_STORE_PATH||new URL('../data/internal-store.json',import.meta.url);
const store=JSON.parse(await fs.readFile(file,'utf8'));
if(!Array.isArray(store.records))throw Error('The legacy store is invalid.');
console.log(`${store.records.length} legacy records found. Staff accounts require Supabase invitations.`);
if(!process.argv.includes('--apply')){console.log('Dry run only. Set Supabase server environment variables and use --apply to import. The source file remains unchanged.');process.exit(0);}
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('Configure Supabase server environment variables before importing.');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
let imported=0;
for(const r of store.records) {
  if(!uuid(r.id))throw Error('A legacy record has no valid idempotency ID. Review it before importing.');
  const values=requestPayload({...r,type:r.type==='shipment'?'booking':r.type,consent:true,date:r.pickupDate||'',requestKey:r.id});
  const ref=/^RT-\d{8}-[A-F0-9]{16}$/.test(r.reference)?r.reference:`${reference().slice(0,12)}${createHash('sha256').update(r.id).digest('hex').slice(0,16).toUpperCase()}`;
  const {data,error}=await client.rpc('royalt_submit_request',{p_customer:values.customer,p_payload:values.payload,p_reference:ref,p_key:r.id});if(error)throw Error('Import failed. Fix the configuration/data and rerun; already imported records retain their references.');
  if(['shipment','pickup','booking'].includes(r.type)) {
    const {error}=await client.from('royalt_shipments').update({booking_status:Object.hasOwn({new:1,pending_pickup:1,in_progress:1,completed:1,cancelled:1},r.status)?r.status:'new',courier_partner:['DHL','UPS'].includes(r.carrier)?r.carrier:null,external_tracking_number:r.trackingId||'',tracking_status:r.status==='completed'?'delivered':r.status==='cancelled'?'cancelled':'pending',...(Number.isFinite(Date.parse(r.createdAt))?{created_at:r.createdAt,booked_at:r.createdAt}:{}),staff_notes:r.staffNotes||'',legacy_data:r}).eq('reference',data);if(error)throw Error('Legacy shipment metadata could not be restored. Rerun after fixing the database configuration.');
  }
  imported++;
}
console.log(`Imported ${imported} records. Source data and existing Supabase records were retained.`);
