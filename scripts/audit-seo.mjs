import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Window} from 'happy-dom';
import {metadata,siteOrigin} from '../seo.js';
import {publicRoutes} from '../pages.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Check the actual generated HTML, including links and assets, before publishing.
export async function auditBuiltSite(output,{origin=siteOrigin()}={}) {
  const errors=[],documents=new Map(),titles=new Set(),descriptions=new Set();
  const check=(condition,message)=>{if(!condition) errors.push(message);};
  const window=new Window({url:origin || 'https://preview.invalid'});
  try {
    for(const route of [...publicRoutes,'/404']) {
      const html=await fs.readFile(path.join(output,route==='/'?'index.html':route.slice(1)+'.html'),'utf8');
      const document=new window.DOMParser().parseFromString(html,'text/html');
      documents.set(route,document);
      const meta=metadata(route,origin),label=`${route}: `;
      check(document.querySelectorAll('title').length===1 && document.title===meta.title,label+'missing or incorrect title');
      check(!titles.has(document.title),label+'duplicate title');titles.add(document.title);
      const description=document.querySelector('meta[name="description"]')?.content;
      check(Boolean(description) && description===meta.description,label+'missing or incorrect description');
      check(!descriptions.has(description),label+'duplicate description');descriptions.add(description);
      check(document.querySelectorAll('h1').length===1,label+'expected one H1');
      check(document.querySelector('meta[name="robots"]')?.content===meta.robots,label+'wrong indexing rules');
      const canonicals=document.querySelectorAll('link[rel="canonical"]');
      check(meta.canonical ? canonicals.length===1 && canonicals[0].href===meta.canonical : canonicals.length===0,label+'wrong canonical');
      const schemas=document.querySelectorAll('script[type="application/ld+json"]');
      check(schemas.length===(meta.known && origin ? 1 : 0),label+'missing or unexpected structured data');
      for(const script of schemas) {
        try {
          const schema=JSON.parse(script.textContent),graph=schema['@graph'];
          check(schema['@context']==='https://schema.org' && Array.isArray(graph),label+'invalid structured data graph');
          const ids=new Set(graph.map(item=>item['@id']));
          for(const item of graph) for(const key of ['publisher','provider','isPartOf','breadcrumb','mainEntity','about']) {
            if(item[key]?.['@id']) check(ids.has(item[key]['@id']),label+`unresolved schema reference ${key}`);
          }
        } catch {errors.push(label+'invalid JSON-LD');}
      }
      for(const image of document.querySelectorAll('img')) {
        check(Boolean(image.getAttribute('alt')),label+'image missing descriptive alt text');
        check(Number(image.getAttribute('width'))>0 && Number(image.getAttribute('height'))>0,label+'image dimensions missing');
      }
    }
    for(const [route,document] of documents) {
      const base=new URL(route,origin || 'https://preview.invalid');
      const targets=[...document.querySelectorAll('a[href],link[href],img[src],script[src]')].map(element=>element.getAttribute('href') || element.getAttribute('src'));
      for(const target of targets) {
        const url=new URL(target,base);
        if(url.origin!==base.origin) continue;
        const pathname=decodeURIComponent(url.pathname),destination=documents.get(pathname);
        if(destination) {
          if(url.hash) check(Boolean(destination.getElementById(decodeURIComponent(url.hash.slice(1)))),`${route}: missing anchor ${target}`);
          continue;
        }
        const relative=pathname.replace(/^\//,''),file=path.resolve(output,pathname==='/internal'?'internal.html':relative);
        if(!file.startsWith(path.resolve(output)+path.sep)) {errors.push(`${route}: unsafe asset path`);continue;}
        try {check((await fs.stat(file)).isFile(),`${route}: target is not a file ${target}`);} catch {errors.push(`${route}: broken link or asset ${target}`);}
      }
    }
    const xml=await fs.readFile(path.join(output,'sitemap.xml'),'utf8');
    const urls=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]);
    const expected=publicRoutes.filter(route=>metadata(route,origin).indexable).map(route=>origin+route);
    check(urls.length===expected.length && expected.every(url=>urls.includes(url)),'Sitemap must contain exactly the indexable canonical pages');
    const robots=await fs.readFile(path.join(output,'robots.txt'),'utf8');
    check(origin ? robots.includes(`Sitemap: ${origin}/sitemap.xml`) && !/^Disallow: \/\s*$/m.test(robots) : robots.includes('Disallow: /'),'Wrong production/preview robots rules');
  } finally {await window.happyDOM.close();}
  if(errors.length) throw Error('SEO audit failed:\n'+[...new Set(errors)].join('\n'));
  return {pages:publicRoutes.length};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const result=await auditBuiltSite(path.join(root,'dist'));
  console.log(`SEO audit passed for ${result.pages} generated public pages.`);
}
