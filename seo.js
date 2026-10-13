import {config} from './site-config.js';
import {services, publicRoutes} from './pages.js';
import {legalRoutes, legalTitle} from './legal-pages.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const serviceMeta = {
  'international-courier':['International Courier from India | DHL & UPS Options','Send documents and parcels overseas from India. Explore DHL and UPS courier options, shipping estimates, pickup requests and customs preparation with Royal T.'],
  'domestic-express':['Domestic Courier Services in India | Documents & Parcels','Arrange domestic document and parcel delivery within India. Share pickup and delivery PIN codes for a courier quote and request collection with Royal T.'],
  'air-cargo':['International Air Cargo & Air Freight Services','Enquire about international air cargo for commercial goods and heavier consignments. Get route, weight, handling and export documentation guidance from Royal T.'],
  'imports':['Imports Express | International Courier to India','Plan international imports and inbound courier shipments to India. Royal T reviews origin, contents, paperwork, delivery requirements and shipment-specific quotes.'],
  'surface-cargo':['Surface Cargo & Road Freight Services in India','Enquire about surface cargo and road freight for bulk goods and business inventory in India. Share your route, boxes, weight and dimensions with Royal T.'],
  'dangerous-goods':['Dangerous Goods Export & DG Cargo Enquiries','Request a dangerous goods export assessment. Royal T reviews product classification, safety data sheets, packaging and carrier acceptance before quoting DG cargo.'],
};
const pageMeta = {
  '/':['Domestic & International Courier Services','Royal T Courier Services handles domestic parcels, international DHL and UPS courier enquiries, pickup requests, imports, air freight and surface cargo in India.'],
  '/services':['Courier & Cargo Services | Domestic & International','Explore Royal T courier and cargo services: domestic express, international parcels, imports to India, air freight, surface transport and dangerous goods enquiries.'],
  '/quote':['Shipping Quote | International & Domestic Courier','Get an international courier estimate by destination and weight, or request a domestic quote using Indian PIN codes. Compare available shipment options with Royal T.'],
  '/pickup':['Request a Courier Pickup | Documents & Parcels','Request parcel or document collection with Royal T. Share your pickup address, preferred date, destination, contents and weight for confirmation by the team.'],
  '/tracking':['Track Your Shipment','Check shipment tracking when updates are available, or contact Royal T for parcel delivery, missing shipment and overdue courier support.'],
  '/about':['About Royal T Courier Services','Learn about Royal T Services Private Limited and its domestic courier, international parcel, import, air cargo and surface transport enquiry services.'],
  '/contact':['Contact Royal T | Courier Quotes & Shipment Support','Contact Royal T Courier Services for domestic and international shipment quotes, parcel pickup requests, cargo enquiries and delivery support.'],
  '/shipping-notes':['Courier Shipping Guide | Packing, Weight & Customs','Prepare your parcel with Royal T shipping guidance on chargeable weight, packaging, customs documents, restricted items, cargo enquiries and shipment acceptance.'],
};
const regionalMeta = {
  '/':['Affordable Courier in Hyderabad & Telangana','Looking for low-cost courier options in Hyderabad and Telangana? Compare domestic and international parcel services, shipping quotes and pickup enquiries with Royal T.'],
  '/services':['Courier Services for Hyderabad & Telangana','Explore domestic parcels, international courier, imports, air freight and surface cargo for customers in Hyderabad and Telangana. Plan your shipment with Royal T.'],
  '/quote':['Courier Charges in Hyderabad | Get a Shipping Quote','Compare international courier charges by destination and weight. Request domestic parcel prices using pickup and delivery PIN codes in Hyderabad, Telangana and India.'],
  '/pickup':['Courier Pickup Requests in Hyderabad & Telangana','Request courier collection in Hyderabad or Telangana. Share your address, destination, contents and weight so Royal T can check route availability and confirm pickup.'],
  '/contact':['Contact Royal T | Hyderabad & Telangana Courier Enquiries','Call Royal T on +91 90001 59988 for courier enquiries from Hyderabad and Telangana, international parcel quotes, pickup requests and shipment support.'],
  '/services/international-courier':['International Courier Hyderabad | Send Parcels Abroad','Send documents and parcels abroad from Hyderabad and Telangana. Compare DHL and UPS options, request a quote and check packing and customs requirements with Royal T.'],
  '/services/domestic-express':['Domestic Courier Hyderabad & Telangana | Parcel Delivery','Enquire about domestic document and parcel courier services from Hyderabad and Telangana. Share Indian pickup and delivery PIN codes for route and price assessment.'],
  '/services/air-cargo':['Air Cargo Enquiries from Hyderabad & Telangana','Plan international air freight for customers in Hyderabad and Telangana. Share commercial cargo dimensions, weight, destination and paperwork for a Royal T quote.'],
  '/services/imports':['Imports Courier to Hyderabad & Telangana','Enquire about international imports to Hyderabad and Telangana. Royal T reviews origin, recipient details, documentation and routing before confirming your shipment.'],
  '/services/surface-cargo':['Surface Cargo for Hyderabad & Telangana | Road Freight','Request road freight and surface cargo quotes for Hyderabad and Telangana business consignments. Share the route, box count, weight and dimensions with Royal T.'],
  '/services/dangerous-goods':['DG Cargo Enquiries | Hyderabad & Telangana Exporters','Discuss dangerous goods export requirements for Hyderabad and Telangana customers. Product classification, paperwork, packing and carrier acceptance need review.'],
};
export function siteOrigin(value = config.seo?.siteUrl) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['','/'].includes(url.pathname) || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(url.hostname)) return '';
    return url.origin;
  } catch { return ''; }
}
export function metadata(path, originValue = config.seo?.siteUrl) {
  const origin = siteOrigin(originValue), service = services.find(s => path === '/services/'+s.slug);
  const known = publicRoutes.includes(path);
  let [title,description] = service ? serviceMeta[service.slug] : pageMeta[path] || (legalRoutes.includes(path) ? [legalTitle(path), `${legalTitle(path)} for Royal T Courier Services. Read about website use, shipment enquiries, customer information and support.`] : ['Page Not Found','The requested page was not found. Browse Royal T courier services or contact our team.']);
  if (config.seo?.targetCity === 'Hyderabad' && regionalMeta[path]) [title,description] = regionalMeta[path];
  if (path === '/' && config.seo?.city) title = `Courier Services in ${config.seo.city} | Domestic & International`;
  const indexable = Boolean(origin && config.seo?.indexingEnabled !== false && known && path !== '/tracking' && !(legalRoutes.includes(path) && config.legal?.status === 'draft'));
  return {path,title:`${title} | Royal T Courier`,description,origin,canonical:origin && known ? origin+path : '',indexable,robots:indexable ? 'index,follow,max-image-preview:large' : 'noindex,follow',known,service};
}
const safeHttps = value => {try {const url = new URL(value); return url.protocol === 'https:' ? url.href : '';} catch {return '';}};
export function structuredData(meta) {
  if (!meta.origin || !meta.known) return null;
  const origin = meta.origin, seo = config.seo || {}, orgId = origin+'/#organization';
  const localReady = seo.localBusinessVerified && seo.streetAddress && seo.city && seo.region && seo.postalCode;
  const org = {'@type':localReady ? 'LocalBusiness' : 'Organization','@id':orgId,name:config.name,legalName:config.legal?.legalName || config.name,url:origin+'/',logo:origin+'/assets/royal-t-logo.jpeg',telephone:config.phone,description:'Domestic and international courier, import and cargo shipment enquiries.'};
  if (seo.targetCity || seo.targetRegion) org.areaServed = [...(seo.targetCity ? [{'@type':'City',name:seo.targetCity}] : []),...(seo.targetRegion ? [{'@type':'State',name:seo.targetRegion}] : [])];
  if (config.email) org.email = config.email;
  const sameAs = [...new Set([...(seo.sameAs || []),seo.googleBusinessUrl].filter(Boolean).map(safeHttps).filter(Boolean))];
  if (sameAs.length) org.sameAs = sameAs;
  if (localReady) {
    org.address = {'@type':'PostalAddress',streetAddress:seo.streetAddress,addressLocality:seo.city,addressRegion:seo.region,postalCode:seo.postalCode,addressCountry:'IN'};
    if (config.hours && seo.openingHoursSpecification?.length) org.openingHoursSpecification = seo.openingHoursSpecification;
  }
  const graph = [org,{'@type':'WebSite','@id':origin+'/#website',url:origin+'/',name:config.name,inLanguage:'en-IN',publisher:{'@id':orgId}}, {'@type':'WebPage','@id':meta.canonical+'#page',url:meta.canonical,name:meta.title,description:meta.description,inLanguage:'en-IN',isPartOf:{'@id':origin+'/#website'}}];
  if (meta.path !== '/') {
    const items = [{name:'Home',url:origin+'/'}];
    if (meta.service) items.push({name:'Courier & Cargo Services',url:origin+'/services'});
    items.push({name:meta.service?.name || meta.title.replace(' | Royal T Courier',''),url:meta.canonical});
    graph.push({'@type':'BreadcrumbList','@id':meta.canonical+'#breadcrumbs',itemListElement:items.map((item,i) => ({'@type':'ListItem',position:i+1,name:item.name,item:item.url}))});
  }
  if (meta.service) {
    const item = {'@type':'Service','@id':meta.canonical+'#service',name:meta.service.name,serviceType:meta.service.type,description:meta.description,url:meta.canonical,provider:{'@id':orgId}};
    if (['domestic-express','surface-cargo'].includes(meta.service.slug)) item.areaServed = {'@type':'Country',name:'India'};
    graph.push(item);
  }
  return {'@context':'https://schema.org','@graph':graph};
}
export const schemaJson = value => JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export function seoHead(meta) {
  const image = meta.origin ? new URL(config.seo?.socialImage || '/assets/royal-t-logo.jpeg',meta.origin).href : '';
  const schema = structuredData(meta);
  return `<title>${escape(meta.title)}</title><meta name="description" content="${escape(meta.description)}"><meta name="robots" content="${meta.robots}">${meta.canonical ? `<link rel="canonical" href="${escape(meta.canonical)}">` : ''}<meta property="og:type" content="website"><meta property="og:locale" content="en_IN"><meta property="og:site_name" content="${escape(config.name)}"><meta property="og:title" content="${escape(meta.title)}"><meta property="og:description" content="${escape(meta.description)}">${meta.canonical ? `<meta property="og:url" content="${escape(meta.canonical)}">` : ''}${image ? `<meta property="og:image" content="${escape(image)}"><meta property="og:image:alt" content="Royal T Courier Services logo">` : ''}<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(meta.title)}"><meta name="twitter:description" content="${escape(meta.description)}">${image ? `<meta name="twitter:image" content="${escape(image)}">` : ''}${config.seo?.searchConsoleVerification ? `<meta name="google-site-verification" content="${escape(config.seo.searchConsoleVerification)}">` : ''}${schema ? `<script id="seo-schema" type="application/ld+json">${schemaJson(schema)}</script>` : ''}`;
}
export function updateSeo(path) {
  const meta = metadata(path,config.seo?.siteUrl || document.documentElement.dataset.siteOrigin);
  document.title = meta.title;
  function set(selector,attributes) {
    let element = document.head.querySelector(selector);
    if (!element) { element = document.createElement(selector.startsWith('link') ? 'link' : 'meta'); document.head.append(element); }
    Object.entries(attributes).forEach(([key,value]) => element.setAttribute(key,value));
  }
  set('meta[name="description"]',{name:'description',content:meta.description});
  set('meta[name="robots"]',{name:'robots',content:meta.robots});
  ['title','description','url'].forEach(key => set(`meta[property="og:${key}"]`,{property:`og:${key}`,content:key === 'url' ? meta.canonical : meta[key]}));
  ['title','description'].forEach(key => set(`meta[name="twitter:${key}"]`,{name:`twitter:${key}`,content:meta[key]}));
  if (meta.canonical) set('link[rel="canonical"]',{rel:'canonical',href:meta.canonical});
  else document.head.querySelector('link[rel="canonical"]')?.remove();
  document.getElementById('seo-schema')?.remove();
  const schema = structuredData(meta);
  if (schema) { const script = document.createElement('script');script.id='seo-schema';script.type='application/ld+json';script.textContent=schemaJson(schema);document.head.append(script); }
}
export function sitemap(originValue = config.seo?.siteUrl) {
  const origin = siteOrigin(originValue);
  if (!origin) return '';
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicRoutes.filter(path => metadata(path,origin).indexable).map(path => `<url><loc>${escape(origin+path)}</loc></url>`).join('')}</urlset>`;
}
export function robots(originValue = config.seo?.siteUrl) {
  const origin = siteOrigin(originValue);
  if (!origin || config.seo?.indexingEnabled === false) return 'User-agent: *\nDisallow: /\n';
  // Let crawlers fetch public JS/CSS. Private pages also carry explicit noindex headers.
  return `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`;
}
