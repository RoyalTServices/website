import {Buffer} from 'node:buffer';
import {createHmac} from 'node:crypto';
import {supabaseApi} from './supabase-api.mjs';
globalThis.Buffer=Buffer;
const env={...Deno.env.toObject(),COOKIE_SECURE:'true'};
env.SUPABASE_PUBLISHABLE_KEY ||= JSON.parse(env.SUPABASE_PUBLISHABLE_KEYS||'{}').default;
env.SUPABASE_SECRET_KEY ||= JSON.parse(env.SUPABASE_SECRET_KEYS||'{}').default;
env.APP_URL ||= 'https://royaltservices.in';
const privilegedKey=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
if(privilegedKey){env.CRON_SECRET ||= createHmac('sha256',privilegedKey).update('royalt/tracking-cron/v1').digest('hex');env.RATE_LIMIT_SECRET ||= createHmac('sha256',privilegedKey).update('royalt/rate-limits/v1').digest('hex');}
const api=supabaseApi({env});
const origins=['https://website-plum-tau-44.vercel.app','https://royaltservices.in','https://www.royaltservices.in'];
Deno.serve(async(request:Request)=>{
  const url=new URL(request.url),path='/api'+url.pathname.split('/royalt-api')[1];
  const headers=Object.fromEntries(request.headers);
  if(headers.origin&&!origins.includes(headers.origin))return Response.json({error:'Request origin not allowed.'},{status:403});
  headers.host=new URL(headers.origin||origins[0]).host;
  const output=new Headers({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});
  let status=200,text='',body;
  const response={getHeader:(name:string)=>name.toLowerCase()==='set-cookie'?output.getSetCookie():output.get(name),
    setHeader(name:string,value:string|string[]){output.delete(name);for(const v of Array.isArray(value)?value:[value])output.append(name,v);},
    writeHead(code:number,values:Record<string,string>){status=code;for(const [key,value]of Object.entries(values))output.set(key,value);},end(value:string){text=value;}};
  try {
    if(request.body){const chunks=[];let size=0;for await(const chunk of request.body){size+=chunk.byteLength;if(size>2097152)return Response.json({error:'The request is too large.'},{status:413});chunks.push(chunk);}const bytes=Buffer.concat(chunks);body=headers['content-type']?.startsWith('application/json')?bytes.toString('utf8'):bytes;}
    // The gateway's connection address is used for rate limiting, never a client-supplied custom IP.
    const req={method:request.method,url:path+url.search,headers,body,socket:{remoteAddress:headers['x-forwarded-for']?.split(',').at(-1)?.trim()||'edge'}};
    const handled=await api(req,response,path);
    if(!handled)return Response.json({error:'Not found.'},{status:404});
    return new Response(text,{status,headers:output});
  }catch{return Response.json({error:'The service is temporarily unavailable.'},{status:503});}
});
