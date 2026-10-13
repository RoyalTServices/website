import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applicationApi} from '../application-api.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const api=applicationApi(root);
export default async function handler(req,res) {
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.setHeader('Cache-Control','no-store');
  const url=new URL(req.url,'https://localhost');
  // The rewrite passes the original API route explicitly. Support both raw Node
  // requests and Vercel's parsed query helper without depending on req.url rewriting.
  const route=req.query?.route ?? url.searchParams.get('route');
  const pathname=route!==null && route!==undefined ? '/api/'+(Array.isArray(route)?route.join('/'):route) : url.pathname;
  if(!/^\/api\/[a-zA-Z0-9/_-]+$/.test(pathname)) {
    res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Not found.'}));return;
  }
  await api(req,res,pathname);
}
