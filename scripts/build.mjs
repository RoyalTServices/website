import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {config} from '../site-config.js';
import {renderSite,publicRoutes,esc} from '../pages.js';
import {metadata,seoHead,sitemap,robots,siteOrigin} from '../seo.js';
import {auditBuiltSite} from './audit-seo.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export async function buildSite(output=path.join(root,'dist'),{environment=process.env.VERCEL_ENV,siteUrl=process.env.SITE_URL || config.seo.siteUrl}={}) {
  const origin=environment && environment!=='production' ? '' : siteOrigin(siteUrl);
  if((!environment || environment==='production')&&!origin)throw Error('Set SITE_URL to the public HTTPS domain before building.');
  // Never publish the workspace wholesale: it also contains customer data,
  // source workbooks, server code and private local configuration.
  await fs.mkdir(output,{recursive:true});
  const template=await fs.readFile(path.join(root,'index.html'),'utf8');
  for(const route of [...publicRoutes,'/404']) {
    const meta=metadata(route,origin),file=route==='/'?'index.html':route.slice(1)+'.html';
    const html=template.replace('<!--SEO_HEAD-->',seoHead(meta)).replace('<html lang="en-IN">',`<html lang="en-IN" data-site-origin="${esc(origin)}">`).replace('<div id="app"></div>',`<div id="app" data-path="${esc(route)}">${renderSite(route)}</div>`);
    await fs.mkdir(path.dirname(path.join(output,file)),{recursive:true});await fs.writeFile(path.join(output,file),html);
  }
  const modules=['app.js','pages.js','pricing.js','quote-options.js','country-combobox.js','site-config.js','service-content.js','seo.js','seo-content.js','legal-content.js','legal-pages.js','assistant.js','assistant-knowledge.js','assistant-nlu.js','assistant-model.js','internal.js','enquiry-view.js','whatsapp.js','billing-ui.js','invoice-math.js','invoice-print.js'];
  for(const file of [...modules,'styles.css','internal.css','internal.html'])await fs.copyFile(path.join(root,file),path.join(output,file));
  // Client-side navigation must preserve preview noindex and the build's domain.
  const clientConfig={...config,seo:{...config.seo,siteUrl:origin}};
  await fs.writeFile(path.join(output,'site-config.js'),`export const config = ${JSON.stringify(clientConfig,null,2)};\n`);
  await fs.cp(path.join(root,'assets'),path.join(output,'assets'),{recursive:true});
  await fs.mkdir(path.join(output,'data'),{recursive:true});await fs.copyFile(path.join(root,'data','rates.json'),path.join(output,'data','rates.json'));
  await fs.writeFile(path.join(output,'robots.txt'),robots(origin));
  await fs.writeFile(path.join(output,'sitemap.xml'),sitemap(origin) || '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  await auditBuiltSite(output,{origin});
  return {pages:publicRoutes.length,origin};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  // Rebuild only this known generated directory, never an arbitrary target.
  const output=path.join(root,'dist');await fs.rm(output,{recursive:true,force:true});
  const result=await buildSite(output);console.log(`Built ${result.pages} pages for ${result.origin || 'a noindex preview'}.`);
}
