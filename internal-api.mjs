import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes, scryptSync, timingSafeEqual, randomUUID} from 'node:crypto';

const statuses = ['new','pending_pickup','in_progress','completed'];
const labels = {new:'New request',pending_pickup:'Pending pickup',in_progress:'In progress',completed:'Completed'};
const failure=(message,status=400)=>Object.assign(new Error(message),{status});
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export function internalApi(root) {
  const storePath = process.env.INTERNAL_STORE_PATH || path.join(root,'data','internal-store.json');
  const sessions = new Map(), attempts = new Map();
  let queue = Promise.resolve();
  const read = async () => { try {const store=JSON.parse(await fs.readFile(storePath,'utf8'));if(!store||!Array.isArray(store.records)||(store.admin&&(!/^[a-f0-9]{128}$/.test(store.admin.hash)||!/^[a-f0-9]{32}$/.test(store.admin.salt))))throw Error();return store;} catch(error) { if(error.code==='ENOENT') return {admin:null,records:[]}; throw failure('Shipment storage is unavailable. Please try again or contact the administrator.',500); } };
  const mutate = operation => {
    const task = queue.then(async () => {
      const store = await read(), result = await operation(store);
      await fs.mkdir(path.dirname(storePath),{recursive:true});
      await fs.writeFile(storePath+'.tmp',JSON.stringify(store,null,2),{mode:0o600});
      await fs.rename(storePath+'.tmp',storePath); return result;
    }); queue = task.catch(()=>{}); return task;
  };
  const send = (res,code,data) => { res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); };
  const body = async req => { let value=''; for await(const chunk of req) { value+=chunk; if(Buffer.byteLength(value)>32000) throw failure('The request is too large. Shorten the description and try again.',413); } let parsed;try {parsed=JSON.parse(value);}catch{throw failure('The request could not be read. Please try again.');}if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw failure('Enter valid request details.');return parsed; };
  const clean = (value,max=3000) => typeof value==='string'?value.trim().slice(0,max):'';
  const authenticated = req => {
    const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('royalt_session='))?.slice(15);
    const session=sessions.get(token); if(!session||session.expires<Date.now()) { sessions.delete(token); return null; } return {token,...session};
  };
  const openSession = (res,username) => {
    for(const [token,entry] of sessions) if(entry.expires<Date.now()) sessions.delete(token);
    const token=randomBytes(32).toString('hex'); sessions.set(token,{username,expires:Date.now()+8*3600000});
    res.setHeader('Set-Cookie',`royalt_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);
  };
  const record = (values,internal=false) => {
    const type=internal?'shipment':values.type;
    if(!['pickup','enquiry','shipment'].includes(type)) throw Error('Choose a valid request type.');
    const name=clean(values.name,100),email=clean(values.email,150),phone=clean(values.phone,30);
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw failure('Enter a valid email address.');
    if(phone&&!/^[+0-9 ()-]{7,30}$/.test(phone))throw failure('Enter a valid phone number.');
    if(values.weight!==undefined&&values.weight!==''&&(!Number.isFinite(Number(values.weight))||Number(values.weight)<=0||Number(values.weight)>99999))throw failure('Enter a valid shipment weight greater than zero.');
    if(values.boxes!==undefined&&values.boxes!==''&&(!Number.isInteger(Number(values.boxes))||Number(values.boxes)<1||Number(values.boxes)>9999))throw failure('Enter a valid number of packages.');
    if(values.date&&!validDate(values.date))throw failure('Enter a valid pickup date.');
    if(!name||(!internal&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&type==='enquiry')||(!email&&!phone)) throw Error('Enter a name and a contact number or email.');
    if(!internal&&values.consent!==true&&values.consent!=='on') throw Error('Please agree to share your enquiry details.');
    if(type==='pickup'&&(!phone||!clean(values.address,500)||!/^\d{4}-\d{2}-\d{2}$/.test(values.date||'')||!clean(values.contents)||!clean(values.destination,120)||!(Number(values.weight)>0))) throw Error('Complete your pickup details.');
    if(type==='enquiry'&&!clean(values.message)) throw Error('Enter your shipment enquiry.');
    const now=new Date().toISOString();
    return {id:randomUUID(),reference:'RT-'+now.slice(0,10).replaceAll('-','')+'-'+randomBytes(3).toString('hex').toUpperCase(),type,status:type==='pickup'?'pending_pickup':'new',name,email,phone,service:clean(values.service,100)||'General enquiry',address:clean(values.address,500),destination:clean(values.destination,120)||(clean(values.toPin,6)?'PIN '+clean(values.toPin,6):''),fromPin:clean(values.fromPin,6),kind:values.kind==='documents'?'Documents':values.kind==='parcels'?'Non-documents':'',weight:clean(String(values.weight||''),30),boxes:clean(String(values.boxes||''),10),message:clean(values.message||values.contents),pickupDate:clean(values.date,10),carrier:clean(values.carrier,80),trackingId:'',staffNotes:'',createdAt:now,updatedAt:now,history:[{at:now,text:type==='pickup'?'Pickup requested':'Request received',by:internal?'Staff':'Website'}]};
  };
  return async (req,res,pathname) => {
    if(!pathname.startsWith('/api/')) return false;
    try {
      if(!['GET','POST','PATCH'].includes(req.method)) { send(res,405,{error:'Method not allowed.'}); return true; }
      if(req.method!=='GET') {
        if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`) { send(res,403,{error:'Request origin not allowed.'}); return true; }
        if(!req.headers['content-type']?.startsWith('application/json')) { send(res,415,{error:'Use JSON for this request.'}); return true; }
      }
      if(pathname==='/api/internal/session'&&req.method==='GET') {
        const store=await read(),auth=authenticated(req); send(res,200,{setupRequired:!store.admin,user:auth?{username:auth.username}:null}); return true;
      }
      if(['/api/internal/setup','/api/internal/login'].includes(pathname)&&req.method==='POST') {
        const key=req.socket.remoteAddress,previous=attempts.get(key)||{count:0,until:0};
        if(previous.until>Date.now()&&previous.count>=8) { send(res,429,{error:'Too many login attempts. Try again in 15 minutes.'}); return true; }
        const values=await body(req),username=clean(values.username,80),password=typeof values.password==='string'?values.password:'';
        if(pathname.endsWith('setup')) {
          if(!/^[a-zA-Z0-9@._-]{3,80}$/.test(username)||password.length<8||password.length>200) throw Error('Use a username of at least 3 characters and a password of 8–200 characters.');
          await mutate(store=>{if(store.admin) throw failure('Staff login already exists. Please sign in.',409); const salt=randomBytes(16).toString('hex'); store.admin={username,salt,hash:scryptSync(password,salt,64).toString('hex')};});
        } else {
          const store=await read(),admin=store.admin;
          const salt=admin?.salt||'invalid-login';
          const hash=scryptSync(password.slice(0,200),salt,64);
          if(!admin||username!==admin.username||!timingSafeEqual(hash,Buffer.from(admin.hash,'hex'))) {
            attempts.set(key,{count:previous.until>Date.now()?previous.count+1:1,until:Date.now()+15*60000}); send(res,401,{error:'Username or password is incorrect.'}); return true;
          }
        }
        attempts.delete(key); openSession(res,username); send(res,200,{user:{username}}); return true;
      }
      if(pathname==='/api/internal/logout'&&req.method==='POST') {
        const auth=authenticated(req); if(auth) sessions.delete(auth.token);
        res.setHeader('Set-Cookie','royalt_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); send(res,200,{ok:true}); return true;
      }
      if(pathname==='/api/requests'&&req.method==='POST') {
        const values=await body(req),entry=record(values);
        await mutate(store=>store.records.push(entry)); send(res,201,{reference:entry.reference}); return true;
      }
      const auth=authenticated(req); if(!auth) {send(res,401,{error:'Please sign in to continue.'});return true;}
      if(pathname==='/api/internal/records'&&req.method==='GET') { const store=await read();send(res,200,{records:store.records});return true; }
      if(pathname==='/api/internal/records'&&req.method==='POST') { const entry=record(await body(req),true);await mutate(store=>store.records.push(entry));send(res,201,{record:entry});return true; }
      const match=pathname.match(/^\/api\/internal\/records\/([a-f0-9-]+)$/);
      if(match&&req.method==='PATCH') {
        const values=await body(req);
        const entry=await mutate(store=>{
          const current=store.records.find(r=>r.id===match[1]);if(!current) throw failure('This shipment no longer exists. Refresh the records list.',404);
          if(values.updatedAt&&values.updatedAt!==current.updatedAt)throw failure('Another staff update changed this shipment. Close these details and refresh the list before saving again.',409);
          if(!statuses.includes(values.status)) throw Error('Choose a valid shipment status.');
          if(values.pickupDate&&!validDate(values.pickupDate))throw failure('Enter a valid pickup date.');
          const now=new Date().toISOString(),changes=[];
          if(current.status!==values.status) changes.push(`Status changed to ${labels[values.status]}`);
          for(const [key,max] of [['pickupDate',10],['carrier',80],['trackingId',80],['staffNotes',3000]]) {
            const next=clean(values[key],max);if(next!==current[key]) changes.push({pickupDate:'Pickup date updated',carrier:'Courier updated',trackingId:'Tracking number updated',staffNotes:'Staff notes updated'}[key]); current[key]=next;
          }
          current.status=values.status;current.updatedAt=now;
          if(changes.length) current.history.push({at:now,text:changes.join(' · '),by:auth.username});return current;
        }); send(res,200,{record:entry});return true;
      }
      send(res,404,{error:'Not found.'});return true;
    } catch(error) {const unexpected=error.code||error instanceof TypeError||error instanceof RangeError;send(res,error.status||(unexpected?500:400),{error:unexpected?'The request could not be saved. Please try again.':error.message});return true;}
  };
}
