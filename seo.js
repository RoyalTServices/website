import {config} from './site-config.js';
import {services, publicRoutes} from './pages.js';
import {legalRoutes, legalTitle} from './legal-pages.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const serviceMeta = {
  'international-courier':['International Courier from India | DHL & UPS Options','Send documents and parcels overseas from India. Explore DHL and UPS courier options, shipping estimates, pickup requests and customs preparation with Royal T.'],
  'domestic-express':['Domestic Courier Services in India | Documents & Parcels','Arrange domestic document and parcel delivery within India. Share pickup and delivery PIN codes for a courier quote and request collection with Royal T.'],
  'air-cargo':['International Air Cargo & Air Freight Services','Enquire about international air cargo for commercial goods and heavier consignments. Get route, weight, handling and export documentation guidance from Royal T.'],
  'surface-cargo':['Surface Cargo & Road Freight Services in India','Enquire about surface cargo and road freight for bulk goods and business inventory in India. Share your route, boxes, weight and dimensions with Royal T.'],
  'dangerous-goods':['Dangerous Goods Export & DG Cargo Enquiries','Request a dangerous goods export assessment. Royal T reviews product classification, safety data sheets, packaging and carrier acceptance before quoting DG cargo.'],
};
const pageMeta = {
  '/':['Domestic & International Courier Services','Royal T Courier Services handles domestic parcels, international DHL and UPS courier enquiries, pickup requests, air freight and surface cargo in India.'],
  '/services':['Courier & Cargo Services | Domestic & International','Explore Royal T courier and cargo services: domestic express, international parcels, air freight, surface transport and dangerous goods enquiries.'],
  '/quote':['Shipping Quote | International & Domestic Courier','Get an international courier estimate by destination and weight, or request a domestic quote using Indian PIN codes. Compare available shipment options with Royal T.'],
  '/pickup':['Request a Courier Pickup | Documents & Parcels','Request parcel or document collection with Royal T. Share your pickup address, preferred date, destination, contents and weight for confirmation by the team.'],
  '/tracking':['Track Your Shipment','Check shipment tracking when updates are available, or contact Royal T for parcel delivery, missing shipment and overdue courier support.'],
  '/about':['About Royal T Courier Services','Learn about Royal T Services Private Limited and its domestic courier, international parcel, air cargo and surface transport enquiry services.'],
  '/contact':['Contact Royal T | Courier Quotes & Shipment Support','Contact Royal T Courier Services for domestic and international shipment quotes, parcel pickup requests, cargo enquiries and delivery support.'],
  '/shipping-notes':['Courier Shipping Guide | Packing, Weight & Customs','Prepare your parcel with Royal T shipping guidance on chargeable weight, packaging, customs documents, restricted items, cargo enquiries and shipment acceptance.'],
};
const regionalMeta = {
  '/':['Courier in Andhra Pradesh & Telangana','Domestic and international courier services for Andhra Pradesh and Telangana. Send documents and parcels, compare shipping quotes and request a pickup with Royal T.'],
  '/services':['Courier & Cargo Services','Explore domestic parcels, international courier, air freight and surface cargo for customers in Andhra Pradesh and Telangana. Plan your shipment with Royal T.'],
  '/quote':['Courier Charges & Shipping Quotes','Compare international courier charges by country and weight. Request domestic parcel prices with pickup and delivery PIN codes. Final charges need confirmation.'],
  '/pickup':['Request a Courier Pickup','Request courier collection in Andhra Pradesh or Telangana. Share your address, destination, contents and weight so Royal T can check coverage and confirm pickup.'],
  '/contact':['Contact & Courier Support',`Contact Royal T at ${config.phone} or ${config.email} for courier quotes, pickup requests and shipment support in Andhra Pradesh and Telangana.`],
  '/services/international-courier':['International Courier from India','Send documents and parcels abroad from Andhra Pradesh and Telangana. Compare DHL and UPS options, request a quote and check packing and customs requirements.'],
  '/services/domestic-express':['Domestic Courier & Parcel Delivery','Enquire about domestic document and parcel courier services from Andhra Pradesh and Telangana. Share pickup and delivery PIN codes for route and price assessment.'],
  '/services/air-cargo':['International Air Cargo & Freight','Plan international air freight from Andhra Pradesh and Telangana. Share commercial cargo dimensions, weight, destination and documents for a shipment-specific quote.'],
  '/services/surface-cargo':['Surface Cargo & Road Freight','Request road freight and surface cargo quotes for Andhra Pradesh and Telangana business consignments. Share the route, box count, weight and dimensions with Royal T.'],
  '/services/dangerous-goods':['Dangerous Goods Export Enquiries','Discuss dangerous goods export requirements from Andhra Pradesh and Telangana. Product classification, documents, packing and carrier acceptance need review.'],
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
  if (config.seo?.targetRegions?.length && regionalMeta[path]) [title,description] = regionalMeta[path];
  if (path === '/' && config.seo?.city && !config.seo?.targetRegions?.length) title = `Courier Services in ${config.seo.city} | Domestic & International`;
  const indexable = Boolean(origin && config.seo?.indexingEnabled !== false && known && path !== '/tracking' && !(legalRoutes.includes(path) && config.legal?.status === 'draft'));
  // Keep one concise brand suffix; some fallback titles already name the business.
  title = /Royal T/.test(title) ? title : `${title} | Royal T`;
  const imagePath = service ? `/assets/services/${service.slug}.jpeg` : config.seo?.socialImage || '/assets/royal-t-logo.jpeg';
  return {path,title,description,origin,canonical:origin && known ? origin+path : '',image:origin ? new URL(imagePath,origin).href : '',imageAlt:service ? `${service.name} — Royal T Courier Services` : config.name,indexable,robots:indexable ? 'index,follow,max-image-preview:large' : 'noindex,follow',known,service};
}
const safeHttps = value => {try {const url = new URL(value); return url.protocol === 'https:' ? url.href : '';} catch {return '';}};
export function structuredData(meta) {
  if (!meta.origin || !meta.known) return null;
  const origin = meta.origin, seo = config.seo || {}, orgId = origin+'/#organization';
  const localReady = !seo.serviceAreaOnly && seo.localBusinessVerified && seo.streetAddress && seo.city && seo.region && seo.postalCode;
  const org = {'@type':localReady ? 'LocalBusiness' : 'Organization','@id':orgId,name:config.name,legalName:config.legal?.legalName || config.name,url:origin+'/',logo:origin+'/assets/royal-t-logo.jpeg',telephone:config.phone,description:'Domestic and international courier and cargo shipment enquiries.'};
  if (seo.targetRegions?.length) org.areaServed = seo.targetRegions.map(name => ({'@type':'State',name}));
  else if (seo.targetCity || seo.targetRegion) org.areaServed = [...(seo.targetCity ? [{'@type':'City',name:seo.targetCity}] : []),...(seo.targetRegion ? [{'@type':'State',name:seo.targetRegion}] : [])];
  if (config.email) org.email = config.email;
  org.contactPoint = {'@type':'ContactPoint',contactType:'customer service',telephone:config.phone,email:config.email,url:origin+'/contact'};
  org.hasOfferCatalog = {'@type':'OfferCatalog',name:'Courier and cargo services',itemListElement:services.map(service => ({'@type':'Offer',itemOffered:{'@type':'Service','@id':origin+'/services/'+service.slug+'#service',name:service.name,url:origin+'/services/'+service.slug,provider:{'@id':orgId}}}))};
  const sameAs = [...new Set([...(seo.sameAs || []),seo.googleBusinessUrl].filter(Boolean).map(safeHttps).filter(Boolean))];
  if (sameAs.length) org.sameAs = sameAs;
  if (localReady) {
    org.address = {'@type':'PostalAddress',streetAddress:seo.streetAddress,addressLocality:seo.city,addressRegion:seo.region,postalCode:seo.postalCode,addressCountry:'IN'};
    if (config.hours && seo.openingHoursSpecification?.length) org.openingHoursSpecification = seo.openingHoursSpecification;
  }
  const page = {'@type':meta.path === '/about' ? 'AboutPage' : meta.path === '/contact' ? 'ContactPage' : meta.path === '/services' ? 'CollectionPage' : 'WebPage','@id':meta.canonical+'#page',url:meta.canonical,name:meta.title,description:meta.description,inLanguage:'en-IN',isPartOf:{'@id':origin+'/#website'},about:{'@id':orgId}};
  if (meta.image) page.primaryImageOfPage = {'@type':'ImageObject',url:meta.image,caption:meta.imageAlt};
  const graph = [org,{'@type':'WebSite','@id':origin+'/#website',url:origin+'/',name:config.name,alternateName:'Royal T',inLanguage:'en-IN',publisher:{'@id':orgId}},page];
  if (meta.path !== '/') {
    const items = [{name:'Home',url:origin+'/'}];
    if (meta.service) items.push({name:'Courier & Cargo Services',url:origin+'/services'});
    items.push({name:meta.service?.name || meta.title.replace(/ \| Royal T(?: Courier)?$/,''),url:meta.canonical});
    page.breadcrumb = {'@id':meta.canonical+'#breadcrumbs'};
    graph.push({'@type':'BreadcrumbList','@id':meta.canonical+'#breadcrumbs',itemListElement:items.map((item,i) => ({'@type':'ListItem',position:i+1,name:item.name,item:item.url}))});
  }
  if (meta.service) {
    const item = {'@type':'Service','@id':meta.canonical+'#service',name:meta.service.name,serviceType:meta.service.type,description:meta.description,url:meta.canonical,provider:{'@id':orgId}};
    if (['domestic-express','surface-cargo'].includes(meta.service.slug)) item.areaServed = {'@type':'Country',name:'India'};
    graph.push(item);
    page.mainEntity = {'@id':item['@id']};
  }
  if (meta.path === '/services') page.mainEntity = {'@type':'ItemList',itemListElement:services.map((service,index) => ({'@type':'ListItem',position:index+1,name:service.name,url:origin+'/services/'+service.slug}))};
  return {'@context':'https://schema.org','@graph':graph};
}
export const schemaJson = value => JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export function seoHead(meta) {
  const image = meta.image;
  const schema = structuredData(meta);
  return `<title>${escape(meta.title)}</title><meta name="description" content="${escape(meta.description)}"><meta name="robots" content="${meta.robots}">${meta.canonical ? `<link rel="canonical" href="${escape(meta.canonical)}">` : ''}<meta property="og:type" content="website"><meta property="og:locale" content="en_IN"><meta property="og:site_name" content="${escape(config.name)}"><meta property="og:title" content="${escape(meta.title)}"><meta property="og:description" content="${escape(meta.description)}">${meta.canonical ? `<meta property="og:url" content="${escape(meta.canonical)}">` : ''}${image ? `<meta property="og:image" content="${escape(image)}"><meta property="og:image:alt" content="${escape(meta.imageAlt)}">` : ''}<meta name="twitter:card" content="${meta.service ? 'summary_large_image' : 'summary'}"><meta name="twitter:title" content="${escape(meta.title)}"><meta name="twitter:description" content="${escape(meta.description)}">${image ? `<meta name="twitter:image" content="${escape(image)}"><meta name="twitter:image:alt" content="${escape(meta.imageAlt)}">` : ''}${config.seo?.searchConsoleVerification ? `<meta name="google-site-verification" content="${escape(config.seo.searchConsoleVerification)}">` : ''}${schema ? `<script id="seo-schema" type="application/ld+json">${schemaJson(schema)}</script>` : ''}`;
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
  for (const [property,content] of [['og:image',meta.image],['og:image:alt',meta.imageAlt]]) set(`meta[property="${property}"]`,{property,content});
  for (const [name,content] of [['twitter:image',meta.image],['twitter:image:alt',meta.imageAlt],['twitter:card',meta.service ? 'summary_large_image' : 'summary']]) set(`meta[name="${name}"]`,{name,content});
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
