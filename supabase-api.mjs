import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {supabaseClients} from './supabase-client.mjs';
import {failure,clean,uuid,reference,validDate,numeric,customer,requestPayload,publicTracking} from './business-validation.mjs';
import {courierAdapters} from './courier-adapters.mjs';

const shipments='royalt_shipments',enquiries='royalt_enquiries',customers='royalt_customers';
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});res.end(JSON.stringify(data));};
export async function result(query) {const {data,error}=await query;if(error)throw failure(error.code==='23505'?'This record already exists. Refresh before retrying.':'The operation could not be completed. Please try again.',error.code==='23505'?409:503);return data;}
export async function jsonBody(req) {
  let value='',parsed;try {
    if(req.body!==undefined){parsed=typeof req.body==='string'?JSON.parse(req.body):req.body;value=JSON.stringify(parsed);}
    else{for await(const chunk of req){value+=chunk;if(Buffer.byteLength(value)>32000)throw failure('The request is too large.',413);}parsed=JSON.parse(value);}
  }catch(error){if(error.status)throw error;throw failure('Enter valid request details.');}
  if(Buffer.byteLength(value)>32000)throw failure('The request is too large.',413);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw failure('Enter valid request details.');return parsed;
}
const legacyRecord=s=>({id:s.id,reference:s.reference,type:s.request_type,status:s.booking_status,name:s.royalt_customers?.name||'',email:s.royalt_customers?.email||'',phone:s.royalt_customers?.phone||'',company:s.royalt_customers?.company||'',customerId:s.customer_id,service:s.service,address:s.sender?.address||'',sender:s.sender,receiver:s.receiver,origin:s.origin,destination:s.destination,fromPin:s.from_pin,toPin:s.to_pin,kind:s.shipment_kind,weight:s.weight||'',boxes:s.packages||'',dimensions:s.dimensions,declaredValue:s.declared_value,message:s.package_description,pickupDate:s.pickup_date||'',carrier:s.courier_partner||'',trackingId:s.external_tracking_number,trackingStatus:s.tracking_status,shippingCost:s.shipping_cost,sellingPrice:s.selling_price,currency:s.currency,estimatedDelivery:s.estimated_delivery||'',deliveredAt:s.delivered_at||'',lastSync:s.last_tracking_sync||'',staffNotes:s.staff_notes,createdAt:s.created_at,updatedAt:s.updated_at,history:[...(s.legacy_data?.history||[]),...(s.royalt_activity||[]).map(e=>({at:e.created_at,text:e.message,by:'Staff'}))]});

export function supabaseApi({env=process.env,clients=supabaseClients,adapters=courierAdapters(env)}={}) {
  const digest=value=>createHash('sha256').update(value).digest();
  const hash=value=>digest(value).toString('hex');
  const ip=req=>env.VERCEL?String(req.headers['x-vercel-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim():req.socket.remoteAddress;
  async function limit(service,req,scope,n=30,seconds=3600) {
    const salt=env.RATE_LIMIT_SECRET||env.CRON_SECRET||env.SUPABASE_SECRET_KEY||'';
    if(!await result(service.rpc('royalt_rate_limit',{p_key:hash(salt+scope+ip(req)),p_limit:n,p_window:seconds})))throw failure('Too many requests. Please try again later.',429);
  }
  async function authorized(staff) {
    const {data,error}=await staff.auth.getUser();if(error||!data.user)throw failure('Please sign in to continue.',401);
    if(!await result(staff.rpc('royalt_staff_access')))throw failure('This staff session is no longer authorized.',403);
    const profile=await result(staff.from('royalt_staff_profiles').select('id,email,display_name,role,active').eq('id',data.user.id).maybeSingle());
    if(!profile?.active)throw failure('Staff access is not enabled for this account.',403);return profile;
  }
  async function record(staff,id) {const s=await result(staff.from(shipments).select('*,royalt_customers(*),royalt_activity(*)').eq('id',id).maybeSingle());if(!s)throw failure('Shipment not found.',404);return legacyRecord(s);}
  async function sync(service) {
    if(!await result(service.rpc('royalt_claim_sync')))return {busy:true};
    const started=Date.now(),run=await result(service.from('royalt_sync_runs').insert({}).select('id').single());let processed=0,failed=0;const errors=[];
    try {
      const partners=await result(service.from('royalt_courier_partners').select('code,integration_status'));
      const enabled=Object.entries(adapters).filter(([code,adapter])=>adapter.configured&&partners.some(p=>p.code===code&&p.integration_status!=='disabled')).map(([code])=>code);
      const active=enabled.length?await result(service.from(shipments).select('id,courier_partner,external_tracking_number,sync_failures').in('courier_partner',enabled).not('external_tracking_number','eq','').not('tracking_status','in','(delivered,cancelled)').neq('booking_status','cancelled').lte('next_tracking_sync',new Date().toISOString()).order('next_tracking_sync').limit(8)):[];
      let lastDhl=0;
      for(const s of active) {
        if(Date.now()-started>45000)break;
        const adapter=adapters[s.courier_partner];
        try {
          if(s.courier_partner==='DHL'&&lastDhl){const wait=5100-(Date.now()-lastDhl);if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));}
          if(s.courier_partner==='DHL')lastDhl=Date.now();
          const update=await adapter.track(s.external_tracking_number);
          await result(service.rpc('royalt_apply_tracking',{p_id:s.id,p_status:update.status,p_estimated:update.estimated,p_delivered:update.delivered,p_events:update.events}));processed++;
          const partner=partners.find(p=>p.code===s.courier_partner);if(partner.integration_status==='unconfigured'){await result(service.from('royalt_courier_partners').update({integration_status:'configured'}).eq('code',partner.code).neq('integration_status','disabled'));partner.integration_status='configured';}
        } catch(error) {
          failed++;errors.push({shipmentId:s.id,partner:s.courier_partner,status:Number(error.status)||0});
          await result(service.from(shipments).update({sync_failures:s.sync_failures+1,next_tracking_sync:new Date(Date.now()+Math.min(24,2**Math.min(s.sync_failures,5))*3600000).toISOString()}).eq('id',s.id));
        }
      }
      await result(service.from('royalt_sync_runs').update({finished_at:new Date().toISOString(),processed,failed,errors}).eq('id',run.id));
      return {processed,failed};
    } finally {await result(service.rpc('royalt_release_sync'));}
  }
  return async(req,res,pathname)=>{
    if(!pathname.startsWith('/api/'))return false;
    try {
      if(!['GET','POST','PATCH'].includes(req.method))throw failure('Method not allowed.',405);
      const url=new URL(req.url,'http://localhost');
      if(req.method!=='GET'&&pathname!=='/api/cron/tracking') {
        if(req.headers.origin&&![`https://${req.headers.host}`,`http://${req.headers.host}`].includes(req.headers.origin))throw failure('Request origin not allowed.',403);
        if(!pathname.endsWith('/documents')&&!req.headers['content-type']?.startsWith('application/json'))throw failure('Use JSON for this request.',415);
      }
      // Check cron secret before creating any database client.
      if(pathname==='/api/cron/tracking') {
        if(req.method!=='POST')throw failure('Method not allowed.',405);
        const secret=env.CRON_SECRET||'';
        if(secret.length<32||!timingSafeEqual(digest(req.headers.authorization||''),digest('Bearer '+secret)))throw failure('Unauthorized.',401);
        const {service}=clients(req,res,env);send(res,200,await sync(service));return true;
      }
      if(pathname.startsWith('/api/internal/')&&!['/api/internal/login','/api/internal/accept-invite','/api/internal/session','/api/internal/setup','/api/internal/logout'].includes(pathname)&&!req.headers.cookie?.includes('sb-'))throw failure('Please sign in to continue.',401);
      // Reject invalid intake before accessing the database.
      const submitted=pathname==='/api/requests'&&req.method==='POST'?requestPayload(await jsonBody(req)):null;
      const {staff,service}=clients(req,res,env);
      if(pathname==='/api/requests'&&req.method==='POST') {
        await limit(service,req,'request',15);const values=submitted;
        const ref=await result(service.rpc('royalt_submit_request',{p_customer:values.customer,p_payload:values.payload,p_reference:reference(),p_key:values.key}));
        send(res,201,{reference:ref});return true;
      }
      if(pathname==='/api/tracking'&&req.method==='GET') {
        await limit(service,req,'tracking',30);const ref=clean(url.searchParams.get('id'),50).toUpperCase();
        if(!/^RT-\d{8}-[A-F0-9]{16}$/.test(ref))throw failure('Shipment not found.',404);
        const s=await result(service.from(shipments).select('id,reference,tracking_status,courier_partner,estimated_delivery,last_tracking_sync').eq('reference',ref).maybeSingle());
        if(!s)throw failure('Shipment not found.',404);
        const events=await result(service.from('royalt_tracking_events').select('status,description,location,event_at,local_timestamp').eq('shipment_id',s.id).order('event_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(100));
        send(res,200,publicTracking(s,events));return true;
      }
      if(pathname==='/api/internal/login'&&req.method==='POST') {
        await limit(service,req,'login',8,900);const values=await jsonBody(req);
        const {error}=await staff.auth.signInWithPassword({email:clean(values.email||values.username,150).toLowerCase(),password:String(values.password||'').slice(0,200)});
        if(error)throw failure('Email or password is incorrect.',401);
        try {const profile=await authorized(staff);send(res,200,{user:{...profile,username:profile.email}});}catch(error){await staff.auth.signOut({scope:'local'});throw error;}return true;
      }
      if(pathname==='/api/internal/accept-invite'&&req.method==='POST') {
        await limit(service,req,'invite',8,900);const values=await jsonBody(req);
        if(String(values.password||'').length<12||String(values.password).length>200)throw failure('Use a password of 12–200 characters.');
        const {error}=await staff.auth.verifyOtp({token_hash:clean(values.tokenHash,200),type:'invite'});if(error)throw failure('The invite is invalid or expired. Ask your administrator for a new invite.',401);
        const profile=await authorized(staff),updated=await staff.auth.updateUser({password:values.password});if(updated.error)throw failure('The password could not be set. Please try again.');
        send(res,200,{user:{...profile,username:profile.email}});return true;
      }
      if(pathname==='/api/internal/session'&&req.method==='GET') {
        try {const profile=await authorized(staff);send(res,200,{setupRequired:false,user:{...profile,username:profile.email}});}catch(error){if([401,403].includes(error.status))send(res,200,{setupRequired:false,user:null});else throw error;}return true;
      }
      if(pathname==='/api/internal/setup')throw failure('Staff registration is disabled. Ask an administrator for an invitation.',403);
      if(pathname==='/api/internal/logout'&&req.method==='POST'){const {error}=await staff.auth.signOut({scope:'local'});if(error)throw failure('Sign out could not be completed. Please try again.');send(res,200,{ok:true});return true;}
      const profile=await authorized(staff);
      if(pathname==='/api/internal/invite'&&req.method==='POST') {
        if(profile.role!=='admin')throw failure('Administrator access required.',403);
        const values=await jsonBody(req),email=customer({name:'Staff',email:values.email}).email,role=values.role==='admin'?'admin':'staff';
        const origin=env.APP_URL||env.SITE_URL;if(!origin?.startsWith('https://'))throw failure('Configure APP_URL before inviting staff.',503);
        const {data,error}=await service.auth.admin.inviteUserByEmail(email,{redirectTo:origin+'/internal'});if(error)throw failure('The invitation could not be sent. Check Auth email configuration.',503);
        await result(service.from('royalt_staff_profiles').upsert({id:data.user.id,email,display_name:clean(values.name,100),role,active:true}));send(res,201,{ok:true});return true;
      }
      if(pathname==='/api/internal/summary'&&req.method==='GET') {
        const counts={};for(const [key,column,value] of [['shipments',null,null],['pending','booking_status','new'],['inTransit','tracking_status','in_transit'],['delivered','tracking_status','delivered'],['exceptions','tracking_status','exception']]){let query=staff.from(shipments).select('id',{count:'exact',head:true});if(key==='pending')query=query.in('booking_status',['new','pending_pickup']);else if(column)query=query.eq(column,value);const {count,error}=await query;if(error)throw failure('Dashboard totals could not be read.',503);counts[key]=count;}
        const recent=await result(staff.from(enquiries).select('*,royalt_customers(name,email,phone)').order('created_at',{ascending:false}).limit(5));send(res,200,{counts,recent});return true;
      }
      if(pathname==='/api/internal/records'&&req.method==='GET') {
        const page=Math.max(0,Math.min(10000,Number(url.searchParams.get('page'))||0)),q=clean(url.searchParams.get('q'),80).replace(/[^a-zA-Z0-9 @._-]/g,'');
        let query=staff.from(shipments).select('*,royalt_customers(*),royalt_activity(*)',{count:'exact'}).order('created_at',{ascending:false});
        if(url.searchParams.get('status'))query=query.eq('booking_status',url.searchParams.get('status'));
        if(url.searchParams.get('trackingStatus'))query=query.eq('tracking_status',url.searchParams.get('trackingStatus'));
        if(q){const people=await result(staff.from(customers).select('id').or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`).limit(100));query=query.or(`reference.ilike.%${q}%,external_tracking_number.ilike.%${q}%,destination.ilike.%${q}%${people.length?',customer_id.in.('+people.map(p=>p.id).join(',')+')':''}`);}
        const {data,count,error}=await query.range(page*50,page*50+49);if(error)throw failure('Shipments could not be read.',503);send(res,200,{records:data.map(legacyRecord),total:count,page});return true;
      }
      if(pathname==='/api/internal/records'&&req.method==='POST') {
        const values=requestPayload(await jsonBody(req),true);
        // The service-only transaction creates a request, not a carrier booking.
        const ref=await result(service.rpc('royalt_submit_request',{p_customer:values.customer,p_payload:values.payload,p_reference:reference(),p_key:values.key}));
        const s=await result(staff.from(shipments).select('id').eq('reference',ref).single());send(res,201,{record:await record(staff,s.id)});return true;
      }
      const match=pathname.match(/^\/api\/internal\/records\/([a-f0-9-]+)(?:\/(events|payments|documents))?$/i);
      if(match&&uuid(match[1])) {
        const id=match[1],section=match[2];await record(staff,id);
        if(!section&&req.method==='GET'){send(res,200,{record:await record(staff,id)});return true;}
        if(!section&&req.method==='PATCH') {
          const v=await jsonBody(req);if(!['new','pending_pickup','in_progress','completed','cancelled'].includes(v.status))throw failure('Choose a valid shipment status.');
          if(v.pickupDate&&!validDate(v.pickupDate)||v.estimatedDelivery&&!validDate(v.estimatedDelivery))throw failure('Enter valid dates.');
          if(v.carrier&&!['DHL','UPS'].includes(v.carrier))throw failure('Choose DHL or UPS.');
          const update={booking_status:v.status,pickup_date:v.pickupDate||null,courier_partner:v.carrier||null,external_tracking_number:clean(v.trackingId,80),staff_notes:clean(v.staffNotes),updated_at:new Date().toISOString()};
          if(!v.updatedAt||!Number.isFinite(Date.parse(v.updatedAt)))throw failure('Refresh the shipment before saving.');
          if(v.service!==undefined)update.service=clean(v.service,100);
          if(v.message!==undefined)update.package_description=clean(v.message);
          if(v.boxes!==undefined)update.packages=numeric(v.boxes,'package count',{integer:true,min:1,max:9999});
          for(const [input,column] of [['shippingCost','shipping_cost'],['sellingPrice','selling_price'],['declaredValue','declared_value'],['weight','weight']])if(v[input]!==undefined)update[column]=numeric(v[input],input,{min:input==='weight'?.001:0})??(['shippingCost','sellingPrice'].includes(input)?0:null);
          if(v.estimatedDelivery!==undefined)update.estimated_delivery=v.estimatedDelivery||null;
          if(v.trackingStatus!==undefined){if(!['pending','in_transit','delivered','exception','cancelled','unknown'].includes(v.trackingStatus))throw failure('Choose a valid tracking status.');update.tracking_status=v.trackingStatus;}
          if(v.sender!==undefined)update.sender={name:clean(v.sender?.name,100),address:clean(v.sender?.address,500),phone:clean(v.sender?.phone,30)};
          if(v.receiver!==undefined)update.receiver={name:clean(v.receiver?.name,100),address:clean(v.receiver?.address,500),phone:clean(v.receiver?.phone,30)};
          if(v.dimensions!==undefined){update.dimensions={};for(const field of ['length','width','height'])update.dimensions[field]=numeric(v.dimensions[field],field,{min:.001,max:9999});}
          if(v.origin!==undefined)update.origin=clean(v.origin,120);if(v.destination!==undefined)update.destination=clean(v.destination,120);
          if(v.status==='cancelled')update.tracking_status='cancelled';if(v.trackingStatus==='delivered'||v.status==='completed'){update.tracking_status='delivered';update.delivered_at=new Date().toISOString();}
          if(v.trackingId||v.carrier)update.next_tracking_sync=new Date().toISOString();
          const changed=await result(staff.rpc('royalt_update_shipment',{p_id:id,p_expected:v.updatedAt||null,p_patch:update}));if(!changed)throw failure('This shipment changed. Refresh before saving.',409);
          send(res,200,{record:await record(staff,id)});return true;
        }
        if(section==='events') {
          if(req.method==='GET'){send(res,200,{events:await result(staff.from('royalt_tracking_events').select('*').eq('shipment_id',id).order('event_at',{ascending:false}).limit(100))});return true;}
          if(req.method==='POST'){const v=await jsonBody(req);if(!validDate(clean(v.timestamp,30).slice(0,10))||!Number.isFinite(Date.parse(v.timestamp)))throw failure('Enter a valid event timestamp.');if(!['pending','in_transit','delivered','exception','cancelled','unknown'].includes(v.status))throw failure('Choose a tracking status.');await result(staff.from('royalt_tracking_events').upsert({shipment_id:id,event_key:uuid(v.requestKey)?v.requestKey:randomUUID(),status:v.status,description:clean(v.description,500),location:clean(v.location,150),event_at:new Date(v.timestamp).toISOString()},{onConflict:'shipment_id,event_key',ignoreDuplicates:true}));await result(staff.from(shipments).update({tracking_status:v.status,last_tracking_sync:new Date().toISOString(),...(v.status==='delivered'?{booking_status:'completed',delivered_at:new Date(v.timestamp).toISOString()}:v.status==='cancelled'?{booking_status:'cancelled'}:{})}).eq('id',id));send(res,201,{ok:true});return true;}
        }
        if(section==='payments') {
          if(req.method==='GET'){send(res,200,{payments:await result(staff.from('royalt_payments').select('*').eq('shipment_id',id).order('paid_at',{ascending:false}))});return true;}
          if(req.method==='POST'){const v=await jsonBody(req),amount=numeric(v.amount,'payment amount',{min:.01});if(!amount||!clean(v.method,50))throw failure('Enter the amount and payment method.');await result(staff.from('royalt_payments').insert({shipment_id:id,amount,currency:'INR',method:clean(v.method,50),transaction_reference:clean(v.transactionReference,150),status:['paid','pending','refunded'].includes(v.status)?v.status:'paid',created_by:profile.id,idempotency_key:uuid(v.requestKey)?v.requestKey:randomUUID()}));send(res,201,{ok:true});return true;}
        }
        if(section==='documents') {
          if(req.method==='GET'){const docs=await result(staff.from('royalt_documents').select('*').eq('shipment_id',id).order('created_at',{ascending:false}));const documents=[];for(const d of docs){const signed=await result(staff.storage.from('royalt-documents').createSignedUrl(d.object_path,60,{download:d.file_name}));documents.push({...d,url:signed.signedUrl});}send(res,200,{documents});return true;}
          if(req.method==='POST') {
            let bytes;if(req.body!==undefined){if(!Buffer.isBuffer(req.body))throw failure('Upload a PDF file.');bytes=req.body;}else {const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>2097152)throw failure('PDF files must be 2 MB or smaller.',413);chunks.push(chunk);}bytes=Buffer.concat(chunks);}
            if(!bytes.length||bytes.length>2097152||bytes.subarray(0,5).toString()!=='%PDF-'||req.headers['content-type']!=='application/pdf')throw failure('Upload a valid PDF file up to 2 MB.');
            const kind=url.searchParams.get('kind');if(!['label','invoice','pickup','pod','other'].includes(kind))throw failure('Choose a document type.');
            const fileName=clean(url.searchParams.get('name'),150).replace(/[\/\\\u0000-\u001f]/g,'_')||'document.pdf',objectPath=id+'/'+randomUUID()+'.pdf';
            await result(service.storage.from('royalt-documents').upload(objectPath,bytes,{contentType:'application/pdf',upsert:false}));
            try{await result(staff.from('royalt_documents').insert({shipment_id:id,object_path:objectPath,file_name:fileName,content_type:'application/pdf',size_bytes:bytes.length,kind,uploaded_by:profile.id}));}catch(error){await service.storage.from('royalt-documents').remove([objectPath]);throw error;}send(res,201,{ok:true});return true;
          }
        }
      }
      if(pathname==='/api/internal/enquiries'&&req.method==='GET'){const page=Math.max(0,Number(url.searchParams.get('page'))||0);let query=staff.from(enquiries).select('*,royalt_customers(*)',{count:'exact'}).order('created_at',{ascending:false});if(url.searchParams.get('status'))query=query.eq('status',url.searchParams.get('status'));const {data,count,error}=await query.range(page*50,page*50+49);if(error)throw failure('Enquiries could not be read.',503);send(res,200,{enquiries:data,total:count,page});return true;}
      const enquiry=pathname.match(/^\/api\/internal\/enquiries\/([a-f0-9-]+)$/i);
      const convert=pathname.match(/^\/api\/internal\/enquiries\/([a-f0-9-]+)\/booking$/i);
      if(convert&&uuid(convert[1])&&req.method==='POST'){const id=await result(staff.rpc('royalt_convert_enquiry',{p_id:convert[1]}));send(res,201,{record:await record(staff,id)});return true;}
      if(enquiry&&uuid(enquiry[1])&&req.method==='PATCH'){const v=await jsonBody(req);if(!['new','reviewing','resolved','closed'].includes(v.status))throw failure('Choose an enquiry status.');const data=await result(staff.from(enquiries).update({status:v.status,staff_notes:clean(v.staffNotes),updated_at:new Date().toISOString()}).eq('id',enquiry[1]).select('id'));if(!data.length)throw failure('Enquiry not found.',404);send(res,200,{ok:true});return true;}
      if(pathname==='/api/internal/customers'&&req.method==='GET'){const page=Math.max(0,Number(url.searchParams.get('page'))||0);let query=staff.from(customers).select('*',{count:'exact'}).order('created_at',{ascending:false});const q=clean(url.searchParams.get('q'),80).replace(/[^a-zA-Z0-9 @._-]/g,'');if(q)query=query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);const {data,count,error}=await query.range(page*50,page*50+49);if(error)throw failure('Customers could not be read.',503);send(res,200,{customers:data,total:count,page});return true;}
      const person=pathname.match(/^\/api\/internal\/customers\/([a-f0-9-]+)$/i);
      if(person&&uuid(person[1])){if(req.method==='PATCH'){const c=customer(await jsonBody(req));const rows=await result(staff.from(customers).update({name:c.name,email:c.email,phone:c.phone,company:c.company,gstin:c.gstin,billing_address:c.billingAddress,updated_at:new Date().toISOString()}).eq('id',person[1]).select('id'));if(!rows.length)throw failure('Customer not found.',404);send(res,200,{ok:true});return true;}if(req.method==='GET'){send(res,200,{shipments:(await result(staff.from(shipments).select('*,royalt_customers(*),royalt_activity(*)').eq('customer_id',person[1]).order('created_at',{ascending:false}).limit(100))).map(legacyRecord)});return true;}}
      throw failure('Not found.',404);
    }catch(error){send(res,error.status||503,{error:error.status?error.message:'The service is temporarily unavailable. Your changes have not been confirmed.'});return true;}
  };
}
