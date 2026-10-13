// Keep the website's existing same-origin API and HttpOnly session cookies.
export function edgeRelay(env,fetcher=fetch) {
  return async(req,res,pathname)=>{
    if(!pathname.startsWith('/api/'))return false;
    try {
      const target=new URL(env.SUPABASE_EDGE_URL);
      if(target.protocol!=='https:')throw Error('Invalid backend URL');
      target.pathname+=pathname.slice(4);
      const source=new URL(req.url,'https://localhost');
      for(const [key,value] of source.searchParams)if(key!=='route')target.searchParams.append(key,value);
      const headers={apikey:env.SUPABASE_PUBLISHABLE_KEY};
      for(const key of ['cookie','origin','content-type','authorization','x-file-name','x-document-kind'])if(req.headers[key])headers[key]=req.headers[key];
      let body;
      if(!['GET','HEAD'].includes(req.method)) {
        // Vercel's lazy parser does not support application/pdf. Read its restored
        // raw stream instead; already parsed data properties remain supported.
        const parsed=Object.getOwnPropertyDescriptor(req,'body');
        if(parsed&&'value' in parsed&&parsed.value!==undefined)body=typeof parsed.value==='string'||Buffer.isBuffer(parsed.value)?parsed.value:JSON.stringify(parsed.value);
        else {const chunks=[];let size=0;for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>2097152)throw Object.assign(Error('The request is too large.'),{status:413});chunks.push(Buffer.from(chunk));}body=Buffer.concat(chunks);}
        if(Buffer.byteLength(body)>2097152)throw Object.assign(Error('The request is too large.'),{status:413});
      }
      const response=await fetcher(target,{method:req.method,headers,body,redirect:'error',signal:AbortSignal.timeout(55000)});
      const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
      res.writeHead(response.status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});
      res.end(await response.text());
    }catch(error){res.writeHead(error.status||503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:error.status?error.message:'The service is temporarily unavailable. Please try again.'}));}
    return true;
  };
}
