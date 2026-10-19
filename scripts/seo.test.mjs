import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {config} from '../site-config.js';
import {metadata,structuredData,sitemap,robots,seoHead,schemaJson,siteOrigin,updateSeo} from '../seo.js';
import {Window} from 'happy-dom';
import {publicRoutes,renderSite} from '../pages.js';
import {createSiteServer} from '../site-server.mjs';
const origin = 'https://royalt.example'; // Test-only origin; never inserted into site configuration.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
test('public services and search content describe outbound international shipping only',()=>{
  assert.ok(!publicRoutes.includes('/services/imports'));
  for(const route of publicRoutes){
    assert.doesNotMatch(renderSite(route),/\bimports?\b|\binbound\b/i,route);
    const meta=metadata(route);assert.doesNotMatch(meta.title+meta.description,/\bimports?\b|\binbound\b/i,route);
  }
  assert.match(metadata('/services/imports').robots,/noindex/);
});

test('confirmed domain and regional search wording are reflected in content and metadata', () => {
  const home = metadata('/');
  assert.equal(home.canonical,'https://royaltservices.in/');
  assert.equal(home.indexable,true);
  assert.match(home.title,/Courier.*Andhra Pradesh.*Telangana/);
  assert.match(home.description,/Domestic and international courier services/);
  assert.match(renderSite('/'),/Domestic and International<br>Courier Services in<br>Andhra Pradesh/);
  assert.doesNotMatch(renderSite('/'),/affordable|low-cost/i);
  assert.doesNotMatch(home.title+home.description,/affordable|low-cost/i);
  assert.match(renderSite('/services/international-courier'),/Sending parcels abroad from Andhra Pradesh and Telangana/);
  assert.match(metadata('/services/international-courier').title,/International Courier from India/);
  assert.match(metadata('/services/international-courier').description,/Andhra Pradesh.*Telangana/);
  assert.match(sitemap(),/<loc>https:\/\/royaltservices\.in\/services\/international-courier<\/loc>/);
  assert.match(robots(),/Sitemap: https:\/\/royaltservices\.in\/sitemap.xml/);
});
test('Andhra Pradesh and Telangana are customer markets, not a fabricated office location', () => {
  const org = structuredData(metadata('/'))['@graph'][0];
  assert.equal(org['@type'],'Organization');
  assert.deepEqual(org.areaServed.map(area => area.name),['Andhra Pradesh','Telangana']);
  assert.equal(org.address,undefined);
  assert.equal(org.geo,undefined);
  assert.ok(!renderSite('/').includes('Based in Hyderabad'));
});

test('each public page has one meaningful H1 and unique search metadata', () => {
  const titles = new Set(), descriptions = new Set();
  for (const route of publicRoutes) {
    const meta = metadata(route,origin), html = renderSite(route);
    assert.equal((html.match(/<h1\b/g) || []).length,1,route);
    assert.ok(meta.description.length >= 70,route);
    assert.ok(!titles.has(meta.title),route);titles.add(meta.title);
    assert.ok(!descriptions.has(meta.description),route);descriptions.add(meta.description);
    assert.equal(meta.canonical,origin+route);
  }
  assert.match(renderSite('/'),/How do I get a courier price estimate/);
});
test('sitemap includes published policies and excludes private/tracking routes, with crawlable JS', () => {
  const xml = sitemap(origin), rules = robots(origin);
  for (const route of ['/','/services/international-courier','/services/domestic-express','/quote','/pickup']) assert.ok(xml.includes(`<loc>${origin+route}</loc>`),route);
  for (const route of ['/internal','/api/','/tracking']) assert.ok(!xml.includes(origin+route),route);
  for(const route of ['/privacy-policy','/terms-and-conditions','/shipping-policy']) {
    assert.ok(xml.includes(`<loc>${origin+route}</loc>`),route);
    assert.equal(metadata(route,origin).indexable,true);
    assert.doesNotMatch(renderSite(route),/Draft for review/);
  }
  assert.match(rules,/Sitemap: https:\/\/royalt\.example\/sitemap.xml/);
  assert.ok(!rules.includes('Disallow: /assets') && !rules.includes('Disallow: /app.js'));
  assert.match(metadata('/tracking',origin).robots,/noindex/);
});
test('canonical origin is configured rather than taken from an arbitrary request host', () => {
  for (const value of ['', 'http://localhost:4174','javascript:alert(1)','https://user:password@example.com','https://example.com/unexpected-base','https://example.com?token=secret']) assert.equal(siteOrigin(value),'',value);
  assert.equal(sitemap(''),'');assert.match(robots(''),/Disallow: \//);
  assert.match(metadata('/','').robots,/noindex/);
});
test('service schema is honest about organisation, location and prices', () => {
  const schema = structuredData(metadata('/services/international-courier',origin));
  assert.equal(schema['@graph'][0]['@type'],'Organization');
  assert.ok(schema['@graph'].some(item => item['@type']==='Service'));
  assert.ok(schema['@graph'].some(item => item['@type']==='BreadcrumbList'));
  const text = JSON.stringify(schema);
  for (const misleading of ['aggregateRating','reviewCount','priceCurrency','SearchAction','FAQPage']) assert.ok(!text.includes(misleading));
  assert.match(text,/919502295222/);
  const old = {...config.seo};
  try {
    Object.assign(config.seo,{serviceAreaOnly:false,localBusinessVerified:true,city:'Test City',streetAddress:'Test Street',region:'Test Region',postalCode:'500001'});
    assert.equal(structuredData(metadata('/',origin))['@graph'][0]['@type'],'LocalBusiness');
    assert.match(renderSite('/contact'),/Test Street/);
  } finally {config.seo = old;}
});

test('service-area mode never exposes a stored private address as an office',()=>{
  const old={...config.seo};
  try {
    Object.assign(config.seo,{serviceAreaOnly:true,localBusinessVerified:true,city:'Private City',streetAddress:'Private Street',region:'Private Region',postalCode:'500001'});
    const org=structuredData(metadata('/'))['@graph'][0];
    assert.equal(org['@type'],'Organization');assert.equal(org.address,undefined);
    assert.doesNotMatch(renderSite('/contact'),/Private Street|Visit us/);
    assert.match(renderSite('/contact'),/without a public walk-in office/);
    assert.doesNotMatch(renderSite('/'),/Based in Private City/);
  } finally {config.seo=old;}
});

test('contact metadata uses the live phone and service schema connects to its page',()=>{
  const contact=metadata('/contact');
  assert.ok(contact.description.includes(config.phone));
  assert.ok(contact.description.includes(config.email));
  assert.doesNotMatch(contact.description,/90001/);
  const graph=structuredData(metadata('/services/air-cargo'))['@graph'];
  const page=graph.find(item=>item['@type']==='WebPage'),service=graph.find(item=>item['@type']==='Service');
  assert.equal(page.mainEntity['@id'],service['@id']);
  assert.ok(graph.some(item=>item['@id']===page.breadcrumb['@id']));
});

test('browser navigation updates social images as well as canonical and structured data',async()=>{
  const window=new Window({url:'https://royaltservices.in'}),previous=globalThis.document;
  globalThis.document=window.document;
  try {
    for(const route of ['/services/air-cargo','/contact','/services/domestic-express']) {
      const meta=metadata(route);updateSeo(route);
      assert.equal(document.querySelector('meta[property="og:image"]').content,meta.image);
      assert.equal(document.querySelector('meta[name="twitter:image:alt"]').content,meta.imageAlt);
      assert.equal(document.querySelector('meta[name="twitter:card"]').content,meta.service?'summary_large_image':'summary');
      assert.equal(document.querySelectorAll('link[rel="canonical"]').length,1);
      assert.equal(document.querySelector('link[rel="canonical"]').href,meta.canonical);
      assert.deepEqual(JSON.parse(document.getElementById('seo-schema').textContent),structuredData(meta));
    }
  } finally {globalThis.document=previous;await window.happyDOM.close();}
});
test('metadata and JSON-LD cannot inject a closing script or HTML attributes', () => {
  const meta = metadata('/',origin);meta.title='</title><script>alert(1)</script>';meta.description='" onload="unsafe';
  const html = seoHead(meta);
  assert.ok(!html.includes('</title><script>alert(1)'));
  assert.ok(html.includes('&quot; onload=&quot;unsafe'));
  assert.ok(!schemaJson({name:'</script><script>bad</script>'}).includes('</script>'));
});
test('HTTP delivers real page content, correct statuses, private noindex and compressed assets', async () => {
  const server = createSiteServer(root,{siteUrl:origin});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const result = await fetch(base+'/services/international-courier?campaign=test',{headers:{Host:'evil.example'}}), html = await result.text();
    assert.equal(result.status,200);assert.match(html,/<h1>International courier<\/h1>/);
    assert.match(html,/Preparing an international parcel/);
    assert.match(html,/<link rel="canonical" href="https:\/\/royalt\.example\/services\/international-courier">/);
    assert.ok(!html.includes('evil.example') && !html.includes('campaign=test'));
    assert.equal(result.headers.get('content-encoding'),'gzip');
    const missing = await fetch(base+'/services/not-a-real-service');assert.equal(missing.status,404);assert.match(await missing.text(),/Page Not Found/);
    const privatePage = await fetch(base+'/internal');assert.match(privatePage.headers.get('x-robots-tag'),/noindex/);
    const api = await fetch(base+'/api/internal/records');assert.equal(api.status,401);assert.match(api.headers.get('x-robots-tag'),/noindex/);
    const slash = await fetch(base+'/services/international-courier/',{redirect:'manual'});assert.equal(slash.status,301);assert.equal(slash.headers.get('location'),'/services/international-courier');
    const map = await fetch(base+'/sitemap.xml');assert.equal(map.status,200);assert.match(await map.text(),/<urlset/);
    for (const module of ['app.js','pages.js','seo.js','seo-content.js','legal-pages.js','assistant.js']) assert.equal((await fetch(base+'/'+module)).status,200,module);
    const rates = await fetch(base+'/data/rates.json');assert.equal(rates.status,200);assert.ok((await rates.json()).countries.length > 0);
    const head = await fetch(base+'/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  } finally {await new Promise(resolve => server.close(resolve));}
});
