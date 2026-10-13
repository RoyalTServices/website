import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
import {internalApi} from './internal-api.mjs';
import {renderSite,publicRoutes,esc} from './pages.js';
import {metadata,seoHead,sitemap,robots} from './seo.js';
import {config} from './site-config.js';
const compress = promisify(gzip);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpeg':'image/jpeg','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
export function createSiteServer(root,{siteUrl = process.env.SITE_URL || config.seo?.siteUrl} = {}) {
  const api = internalApi(root);
  async function send(req,res,status,content,type,headers = {}) {
    let bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const acceptsGzip = (req.headers['accept-encoding'] || '').split(',').some(item => /^\s*gzip(?:\s*;|\s*$)/.test(item) && !/;\s*q=0(?:\.0*)?(?:\s*;|\s*$)/.test(item));
    if (bytes.length > 1024 && /(?:text|json|javascript|svg|xml)/.test(type) && acceptsGzip) {bytes = await compress(bytes);headers['Content-Encoding']='gzip';}
    res.writeHead(status,{'Content-Type':type,'Content-Length':bytes.length,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Vary':'Accept-Encoding',...headers});
    res.end(req.method === 'HEAD' ? undefined : bytes);
  }
  return http.createServer(async (req,res) => {
    try {
      const url = new URL(req.url,'http://localhost'), pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith('/api/')) res.setHeader('X-Robots-Tag','noindex, nofollow');
      if (await api(req,res,pathname)) return;
      if (!['GET','HEAD'].includes(req.method)) {await send(req,res,405,'Method not allowed','text/plain; charset=utf-8',{'Allow':'GET, HEAD','X-Robots-Tag':'noindex'});return;}
      if (pathname === '/robots.txt') {await send(req,res,200,robots(siteUrl),'text/plain; charset=utf-8');return;}
      if (pathname === '/sitemap.xml') {const xml=sitemap(siteUrl);await send(req,res,xml?200:503,xml || 'Configure the public HTTPS site URL before generating the sitemap.',xml?'application/xml; charset=utf-8':'text/plain; charset=utf-8',{'X-Robots-Tag':'noindex'});return;}
      if (['/index.html','/internal.html'].includes(pathname) || (pathname.length > 1 && pathname.endsWith('/') && [...publicRoutes,'/internal'].includes(pathname.slice(0,-1)))) {
        const target = pathname === '/index.html' ? '/' : pathname === '/internal.html' ? '/internal' : pathname.slice(0,-1);
        res.writeHead(301,{'Location':target+url.search,'Cache-Control':'no-cache'});res.end();return;
      }
      if (pathname === '/internal') {const html = await fs.readFile(path.join(root,'internal.html'));await send(req,res,200,html,types['.html'],{'X-Robots-Tag':'noindex, nofollow'});return;}
      const relative = pathname.replace(/^\/+/, '');
      const staticFile = /^[a-zA-Z0-9_-]+\.js$/.test(relative) || ['styles.css','internal.css'].includes(relative) || relative.startsWith('assets/') || relative === 'data/rates.json';
      if (staticFile) {
        const absolute = path.resolve(root,relative);
        if (!absolute.startsWith(root+path.sep)) {await send(req,res,403,'Forbidden','text/plain',{'X-Robots-Tag':'noindex'});return;}
        try {const body=await fs.readFile(absolute);await send(req,res,200,body,types[path.extname(relative)] || 'application/octet-stream');}
        catch {await send(req,res,404,'Not found','text/plain',{'X-Robots-Tag':'noindex'});}
        return;
      }
      const meta = metadata(pathname,siteUrl), template = await fs.readFile(path.join(root,'index.html'),'utf8');
      const html = template.replace('<!--SEO_HEAD-->',seoHead(meta)).replace('<html lang="en-IN">',`<html lang="en-IN" data-site-origin="${esc(meta.origin)}">`).replace('<div id="app"></div>',`<div id="app" data-path="${esc(pathname)}">${renderSite(pathname)}</div>`);
      await send(req,res,meta.known?200:404,html,types['.html'],meta.indexable?{}:{'X-Robots-Tag':'noindex, follow'});
    } catch {
      if (!res.headersSent) await send(req,res,400,'The request could not be processed.','text/plain; charset=utf-8',{'X-Robots-Tag':'noindex'});
      else res.end();
    }
  });
}
