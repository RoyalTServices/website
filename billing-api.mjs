import {failure,uuid,clean} from './business-validation.mjs';
import {businessDetails,invoiceCalculation} from './invoice-math.js';
import {config} from './site-config.js';
const defaults={businessName:config.legal.legalName||config.name,tradeName:config.name,address:'',gstin:'',stateCode:'',phone:config.phone,email:config.email,invoicePrefix:'RTC',priceMode:'inclusive',sac:'',defaultTaxRate:'',terms:'',signatory:''};
const check=({data,error})=>{if(error)throw failure('Billing could not be completed. Please refresh and retry.',503);return data;};
const validate=fn=>{try{return fn();}catch(e){throw failure(e.message);}};
export async function billingApi(service,profile,req,pathname,url,readBody){
  const settings=async()=>check(await service.from('royalt_business_settings').select('details,updated_at').eq('id',1).single());
  if(pathname==='/api/internal/business-settings'){
    if(req.method==='GET'){const row=await settings();return {settings:{...defaults,...row.details},updatedAt:row.updated_at};}
    if(req.method!=='POST')throw failure('Method not allowed.',405);
    if(profile.role!=='admin')throw failure('Only administrators can change billing defaults.',403);
    const v=await readBody(req),details=validate(()=>businessDetails(v));if(!v.updatedAt)throw failure('Refresh business details before saving.',409);
    const row=check(await service.from('royalt_business_settings').update({details,updated_at:new Date().toISOString(),updated_by:profile.id}).eq('id',1).eq('updated_at',v.updatedAt).select('details,updated_at').maybeSingle());if(!row)throw failure('Business details changed. Refresh before saving.',409);
    return {settings:row.details,updatedAt:row.updated_at};
  }
  if(pathname==='/api/internal/invoices'&&req.method==='GET'){
    const page=Math.max(0,Math.min(10000,Number(url.searchParams.get('page'))||0)),q=clean(url.searchParams.get('q'),80).replace(/[^a-zA-Z0-9 /-]/g,'');
    let query=service.from('royalt_invoices').select('id,shipment_id,invoice_number,issued_date,buyer_name,total_paise,booking_reference',{count:'exact'}).order('created_at',{ascending:false});
    if(q)query=query.or(`invoice_number.ilike.%${q}%,buyer_name.ilike.%${q}%,booking_reference.ilike.%${q}%`);
    const {data,count,error}=await query.range(page*50,page*50+49);if(error)throw failure('Invoices could not be loaded.',503);return {invoices:data,total:count,page};
  }
  const saved=pathname.match(/^\/api\/internal\/invoices\/([a-f0-9-]+)$/i);
  if(saved&&uuid(saved[1])&&req.method==='GET'){const invoice=check(await service.from('royalt_invoices').select('*').eq('id',saved[1]).maybeSingle());if(!invoice)throw failure('Invoice not found.',404);return {invoice};}
  const match=pathname.match(/^\/api\/internal\/records\/([a-f0-9-]+)\/invoice$/i);if(!match||!uuid(match[1]))return null;
  if(!['GET','POST'].includes(req.method))throw failure('Method not allowed.',405);
  const id=match[1],existing=check(await service.from('royalt_invoices').select('*').eq('shipment_id',id).maybeSingle());
  if(existing)return {invoice:existing};
  const shipment=check(await service.from('royalt_shipments').select('*,royalt_customers(*)').eq('id',id).maybeSingle());if(!shipment)throw failure('Booking not found.',404);
  const row=await settings();
  if(req.method==='GET')return {invoice:null,settings:{...defaults,...row.details},settingsUpdatedAt:row.updated_at,shipment};
  if(req.method!=='POST')throw failure('Method not allowed.',405);
  if(!['confirmed','in_progress','completed'].includes(shipment.booking_status))throw failure('Confirm the booking before issuing a GST invoice.',409);
  const values=await readBody(req);if(values.recordUpdatedAt!==shipment.updated_at||values.settingsUpdatedAt!==row.updated_at)throw failure('Booking or business details changed. Refresh the invoice form.',409);
  if(shipment.currency!=='INR')throw failure('This invoice flow supports INR bookings only.');
  const snapshot=validate(()=>invoiceCalculation(values,row.details));
  snapshot.booking={reference:shipment.reference,service:shipment.service,carrier:shipment.courier_partner||'',trackingNumber:shipment.external_tracking_number||'',origin:shipment.origin,destination:shipment.destination,weight:shipment.weight,packages:shipment.packages};
  const result=await service.rpc('royalt_issue_invoice',{p_shipment:id,p_record_updated:values.recordUpdatedAt,p_settings_updated:row.updated_at,p_snapshot:snapshot,p_staff:profile.id});
  if(result.error){if(result.error.code==='40001')throw failure('Booking or business details changed. Refresh before issuing.',409);throw failure('Invoice could not be issued. Refresh and retry; no duplicate number will be created.',503);}
  return {invoice:result.data};
}
