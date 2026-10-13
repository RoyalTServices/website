import {createClient} from '@supabase/supabase-js';
import {createServerClient,parseCookieHeader,serializeCookieHeader} from '@supabase/ssr';

export function supabaseClients(req,res,env=process.env) {
  const url=env.SUPABASE_URL,key=env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY,secret=env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key || !secret)throw Object.assign(Error('The service is not configured. Please contact Royal T.'),{status:503});
  const requestCookies=parseCookieHeader(req.headers.cookie||'');
  const timedFetch=(resource,options={})=>fetch(resource,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});
  const staff=createServerClient(url,key,{
    global:{fetch:timedFetch},
    cookieOptions:{httpOnly:true,secure:Boolean(env.VERCEL)||env.COOKIE_SECURE==='true',sameSite:'lax',path:'/',maxAge:28800},
    cookies:{getAll:()=>requestCookies,setAll(cookies){
      const existing=res.getHeader('Set-Cookie')||[];
      res.setHeader('Set-Cookie',[...(Array.isArray(existing)?existing:[existing]),...cookies.map(({name,value,options})=>serializeCookieHeader(name,value,{...options,maxAge:value?28800:0,httpOnly:true,secure:Boolean(env.VERCEL)||env.COOKIE_SECURE==='true',sameSite:'lax',path:'/'}))]);
      for(const cookie of cookies){const found=requestCookies.find(item=>item.name===cookie.name);if(found)found.value=cookie.value;else requestCookies.push(cookie);}
    }}
  });
  const service=createClient(url,secret,{global:{fetch:timedFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  return {staff,service};
}
