import { config } from './site-config.js';
import { calculateRate } from './pricing.js';
import { services, dockPanel, button, esc, renderSite } from './pages.js';
import { updateSeo } from './seo.js';
const $ = (selector, root = document) => root.querySelector(selector);
let releaseHeaderScroll=()=>{};
const getRates = async () => {
  // Refresh published prices for each quote; a failed backend must not silently serve old prices.
  const response=await fetch('/api/rates',{cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(response.ok)return response.json();
  throw Error('Current rates could not be loaded. Please refresh or request a quote.');
};
async function render() {

  let path=location.pathname.replace(/\/$/,'')||'/';
  const app = $('#app');
  if (app.dataset.path !== path) app.innerHTML = renderSite(path);
  app.dataset.path = path;
  updateSeo(path);
  bindCommon();
  if(path==='/') bindDock();
  if(path==='/quote') initQuote();
  if(path==='/tracking') initTracking();
  if(path==='/pickup'||path==='/contact') initRequest(path);
}
function scrollToSection() { if(location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior:'instant'}); }
function navigate(href) { const samePage=new URL(href,location.origin).pathname===location.pathname;history.pushState({},'',href);if(!samePage)render();window.scrollTo({top:0,behavior:'instant'});scrollToSection();$('#main').focus({preventScroll:true}); }
document.addEventListener('click',event=>{const link=event.target.closest('a[data-link]');if(!link||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();navigate(link.getAttribute('href'));});
window.addEventListener('popstate',()=>{render();window.scrollTo(0,0);scrollToSection();});
function bindCommon() {
  const toggle=$('.menu-toggle'),nav=$('#navigation');
  toggle.onclick=()=>{const opened=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!opened));toggle.setAttribute('aria-label',opened?'Open navigation':'Close navigation');nav.classList.toggle('open',!opened);};
  document.onkeydown=e=>{if(e.key==='Escape'&&nav.classList.contains('open')){toggle.click();toggle.focus();}};
  bindHeaderScroll();
}
function bindHeaderScroll(){
  releaseHeaderScroll();
  const header=$('.site-header'),toggle=$('.menu-toggle');
  if(!header)return;
  let previous=Math.max(0,window.scrollY),distance=0,direction=0,frame=0;
  const reveal=()=>{header.classList.remove('header-folded');distance=0;};
  const measure=()=>document.documentElement.style.setProperty('--site-header-height',`${header.offsetHeight}px`);
  const update=()=>{
    frame=0;
    const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight),position=Math.min(max,Math.max(0,window.scrollY)),delta=position-previous;
    previous=position;
    if(position<=header.offsetHeight||toggle.getAttribute('aria-expanded')==='true'||(header.contains(document.activeElement)&&document.activeElement.matches(':focus-visible'))){reveal();direction=0;return;}
    if(!delta)return;
    const next=delta>0?1:-1;
    if(next!==direction){distance=0;direction=next;}
    distance+=Math.abs(delta);
    if(distance>=(next>0?16:10)){header.classList.toggle('header-folded',next>0);distance=0;}
  };
  const onScroll=()=>{if(!frame)frame=requestAnimationFrame(update);};
  header.classList.remove('header-folded');measure();
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',measure);
  header.addEventListener('focusin',reveal);
  releaseHeaderScroll=()=>{window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',measure);header.removeEventListener('focusin',reveal);if(frame)cancelAnimationFrame(frame);};
}
function bindDock() {
  const bindQuick=()=>$('#quick-track')?.addEventListener('submit',e=>{e.preventDefault();navigate('/tracking?id='+encodeURIComponent(new FormData(e.target).get('tracking').trim()));});
  const activate=tab=>{document.querySelectorAll('[data-tool]').forEach(t=>{t.classList.toggle('active',t===tab);t.setAttribute('aria-selected',String(t===tab));t.tabIndex=t===tab?0:-1;});$('#dock-panel').setAttribute('aria-labelledby',tab.id);$('#dock-panel').innerHTML=dockPanel(tab.dataset.tool);bindQuick();};
  document.querySelectorAll('[data-tool]').forEach((tab,i,tabs)=>{tab.addEventListener('click',()=>activate(tab));tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;activate(tabs[n]);tabs[n].focus();}});});bindQuick();
}
const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n);
async function initQuote() {
  const form=$('#quote-form'),select=$('#country'),result=$('#quote-result'),error=$('#quote-error'),submit=$('#quote-submit');
  const initialResult=result.innerHTML;
  let mode='international',rateError='',revision=0;
  const tabs=[...form.querySelectorAll('[data-quote-mode]')];
  const activate=tab=>{
    mode=tab.dataset.quoteMode;revision++;
    tabs.forEach(item=>{item.setAttribute('aria-selected',String(item===tab));item.tabIndex=item===tab?0:-1;});
    for(const name of ['international','domestic']){const panel=form.querySelector('#quote-'+name);panel.hidden=name!==mode;panel.disabled=name!==mode;}
    form.querySelector('#quote-weight-label').innerHTML=mode==='domestic'?'Shipment weight <span>(kg)</span>':'Chargeable weight <span>(kg)</span>';
    form.querySelector('#quote-weight-hint').textContent=mode==='domestic'?'Enter the parcel weight. Final chargeable weight and pricing are confirmed after checking dimensions.':'Use the carrier-confirmed chargeable weight. If you only know the actual weight, ask us to check your parcel dimensions.';
    submit.innerHTML=mode==='domestic'?'Request domestic quote <span>→</span>':'Explore shipping options <span>→</span>';
    result.innerHTML=mode==='domestic'?'<span class="tiny">DOMESTIC SHIPPING</span><h2>Domestic Quote</h2><p>Enter the pickup and delivery PIN codes, shipment type and weight. Our team will confirm availability and pricing for the route.</p>':initialResult;
    error.textContent=mode==='international'?rateError:'';
  };
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>activate(tab));
    tab.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):tabs[1-index];activate(next);next.focus();}});
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const values=new FormData(form),weight=Number(values.get('weight')),kind=values.get('kind'),requestRevision=revision;
    error.textContent='';
    if(!Number.isFinite(weight)||weight<=0){error.textContent='Enter a valid shipment weight.';return;}
    if(mode==='domestic'){
      const fromPin=String(values.get('from-pin')||'').trim(),toPin=String(values.get('to-pin')||'').trim();
      if(!/^[1-9][0-9]{5}$/.test(fromPin)||!/^[1-9][0-9]{5}$/.test(toPin)){error.textContent='Enter valid 6-digit From and To PIN codes.';return;}
      const query=new URLSearchParams({service:'Domestic express',intent:'quotation',fromPin,toPin,weight:String(weight),kind});
      result.innerHTML=`<span class="tiny">DOMESTIC SHIPPING</span><h2>Request a Route Quote</h2><dl class="domestic-summary"><div><dt>From PIN code</dt><dd>${esc(fromPin)}</dd></div><div><dt>To PIN code</dt><dd>${esc(toPin)}</dd></div><div><dt>Shipment</dt><dd>${weight} kg · ${kind==='documents'?'Documents':'Parcel'}</dd></div></dl><p>Domestic rates and route availability need confirmation from our team.</p>${button('/contact?'+query.toString(),'Continue with enquiry','outline')}`;
      return;
    }
    submit.disabled=true;
    try{
      const data=await getRates();
      if(!form.isConnected||requestRevision!==revision)return;
      const country=data.countries.find(c=>c.name===select.value);
      if(!country)throw Error('Choose a destination country.');
    const expired=Boolean(data.validUntil&&new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})>data.validUntil);
    $('#quote-result').innerHTML=`<span class="tiny">SHIPPING OPTIONS</span><h2 class="result-destination">India <span>→</span><br>${esc(country.name)}</h2><p class="result-meta">${weight} kg · ${kind==='documents'?'Documents':'Parcel'}</p>${[...['DHL','UPS'].map(carrier=>({carrier})),...(data.SELF?.routes||[]).filter(route=>route.country===country.name).map(route=>({carrier:'SELF',route}))].map(({carrier,route})=>{const result=calculateRate(data,carrier,route||country,kind,weight);const until=carrier==='SELF'?data.SELF.validUntil:data.validUntil;const from=carrier==='SELF'?data.SELF.validFrom:data.validFrom;const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});const outsidePeriod=Boolean(until&&today>until||from&&today<from);return `<article class="rate-option"><div class="rate-carrier"><strong>${carrier==='SELF'?'Self':carrier}</strong><span>${carrier==='SELF'?'Self managed · '+esc(route.name):carrier==='DHL'?'Express Worldwide':'Express Saver'}</span></div>${result.manual?`<h3>Rate enquiry required</h3><p>${result.reason}</p>${button('/contact?'+new URLSearchParams({service:'Spot-rate enquiry',intent:'quotation',carrier,selfService:route?.name||'',destination:country.name,weight:String(weight),kind}).toString(),'Request a rate','outline')}`:`<span class="tiny">${outsidePeriod?'OUTSIDE VALIDITY PERIOD':'REFERENCE ESTIMATE'}</span><div class="rate-price">${money(result.amount)}</div><p>Rate slab: ${result.chargedWeight} kg</p>${button('/contact?'+new URLSearchParams({service:'International courier',intent:'booking',carrier,destination:country.name,weight:String(weight),kind,referenceEstimate:String(result.amount),quoteValidUntil:until||'',selfService:route?.name||'',chargedWeight:String(result.chargedWeight)}).toString(),'Confirm this shipment','outline')}`}${carrier==='SELF'?`<p class="input-hint">${esc(route.group)}${route.maxWeight<99999?` · Maximum ${route.maxWeight} kg.`:""} ${esc(route.notes)}</p>`:''}${outsidePeriod?'<p class="input-hint">Request a current quote before shipping.</p>':''}</article>`;}).join('')}${expired?'<p class="input-hint">The supplied rates have expired. Request a current quote before shipping.</p>':''}`;
      error.textContent='';
    }catch(failure){if(form.isConnected&&requestRevision===revision)error.textContent=failure.message;}
    finally{submit.disabled=false;}
  });
  try{
    const data=await getRates();if(!form.isConnected)return;
    select.innerHTML='<option value="">Choose a destination</option>'+data.countries.map((country,index)=>`<option value="${esc(country.name)}">${esc(country.name)}</option>`).join('');select.disabled=false;
    const search=$('#country-search'),status=$('#country-search-status');
    search.disabled=false;
    search.addEventListener('input',()=>{
      const term=search.value.trim().toLocaleLowerCase(),previous=select.value;
      const matches=data.countries.map((country,index)=>({country,index})).filter(({country})=>country.name.toLocaleLowerCase().includes(term)||country.code.toLocaleLowerCase()===term);
      select.innerHTML='<option value="">'+(matches.length?'Choose a destination':'No matching countries')+'</option>'+matches.map(({country,index})=>`<option value="${esc(country.name)}">${esc(country.name)}</option>`).join('');
      if(matches.some(m=>m.country.name===previous))select.value=previous;
      status.textContent=matches.length+' destinations found';
    });
  }catch{
    rateError='International rates could not be loaded. Refresh or prepare an enquiry.';
    if(form.isConnected&&mode==='international')error.textContent=rateError;
  }
}
async function loadTracking(id,signal) {
  if(!config.trackingEndpoint)return {unavailable:true};
  const url=new URL(config.trackingEndpoint,location.origin);url.searchParams.set('id',id);
  const response=await fetch(url,{signal});
  if(response.status===404)return {notFound:true};
  if(!response.ok)throw Error('Tracking could not be loaded. Please try again shortly.');
  let data;try{data=await response.json();}catch{throw Error('Shipment updates could not be read. Please contact us for the status.');}
  if(!data||typeof data.status!=='string'||!Array.isArray(data.events)||data.events.some(event=>!event||typeof event.status!=='string'||typeof event.timestamp!=='string'))throw Error('The tracking service returned an unexpected response. Please contact us.');
  return data;
}
function trackingHelp(id,failed=false,detail=''){
  const phone=String(config.phone||'').replace(/\D/g,''),whatsapp=String(config.whatsapp||'').replace(/\D/g,'');
  const message=`Please help me check the status of shipment ${id}.`;
  return `<div class="tracking-empty"><span class="tiny">SHIPMENT STATUS</span><h2>${failed?'Unable to Check Shipment':'Tracking ID Not Active Yet'}</h2><p>${failed?esc(detail||'We could not check your shipment right now.'): `Updates for tracking ID <strong>${esc(id)}</strong> are not available yet.`} Please contact us on WhatsApp or call for the latest status.</p><div class="tracking-contact-actions">${whatsapp?`<a class="button" href="https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer">WhatsApp us <span aria-hidden="true">↗</span></a>`:''}${phone?`<a class="button outline" href="tel:+${phone}">Call us <span aria-hidden="true">↗</span></a>`:''}${!phone&&!whatsapp?button('/contact?service=Tracking%20support','Contact us','outline'):''}</div></div>`;
}
function initTracking() {
  const form=$('#tracking-form'),field=$('#tracking-id'),result=$('#tracking-result');field.value=new URLSearchParams(location.search).get('id')||'';
  form.addEventListener('submit',async e=>{e.preventDefault();const id=field.value.trim();if(!id){$('#tracking-error').textContent='Enter your tracking ID.';return;}const submit=$('button',form);submit.disabled=true;$('#tracking-error').textContent='';result.innerHTML='<div class="tracking-skeleton" aria-label="Loading shipment updates"><div></div><div></div><div></div></div>';const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{const data=await loadTracking(id,controller.signal);if(!result.isConnected)return;
      if(data.unavailable||data.notFound)result.innerHTML=trackingHelp(id);
      else result.innerHTML=`<span class="tiny">${esc(id)}</span><h2>${esc(data.status)}</h2>${data.partner?`<p>Courier: ${esc(data.partner)}</p>`:''}${data.location?`<p>Latest location: ${esc(data.location)}</p>`:''}${data.lastUpdate?`<p>Last tracking update: ${esc(data.lastUpdate)}</p>`:'<p>Awaiting the first tracking update.</p>'}${data.partner==='DHL'?'<p>Delivered by Deutsche Post DHL Group</p>':''}${data.estimatedDelivery?`<p>Expected delivery: ${esc(data.estimatedDelivery)}</p>`:''}<ol class="tracking-timeline">${data.events.map(event=>`<li><span class="status-dot"></span><div><strong>${esc(event.status)}</strong><p>${esc(event.location)}</p><time>${esc(event.timestamp)}</time></div></li>`).join('')}</ol>${data.events.length?'':'<p>No shipment events are available yet.</p>'}`;
    }catch(error){if(result.isConnected){result.innerHTML=trackingHelp(id,true,error.name==='AbortError'?'The status check timed out.':error instanceof TypeError?'The tracking service could not be reached.':error.message);}}
    finally{clearTimeout(timeout);submit.disabled=false;}
  });
}
function initRequest(path) {
  const form=$(path==='/pickup'?'#pickup-form':'#contact-form');
  const service=new URLSearchParams(location.search).get('service');if(service){const option=[...form.service.options].find(o=>o.value===service);if(option)form.service.value=service;else if(path==='/contact')form.message.value=`I would like help with ${service}.\n`;} 
  if(path==='/contact'){
    const route=new URLSearchParams(location.search),fromPin=route.get('fromPin')||'',toPin=route.get('toPin')||'',weight=Number(route.get('weight'));
    const destination=(route.get('destination')||'').trim().slice(0,120),carrier=route.get('carrier');
    for(const key of ['intent','destination','weight','kind','carrier','fromPin','toPin','referenceEstimate','quoteValidUntil','chargedWeight','selfService']){
      if(route.get(key)){const hidden=document.createElement('input');hidden.type='hidden';hidden.name=key;hidden.value=route.get(key).slice(0,120);form.append(hidden);}
    }
    if(route.get('intent')==='booking'&&destination&&['DHL','UPS','SELF'].includes(carrier)&&Number.isFinite(weight)&&weight>0&&weight<=99999){
      const shipment=`from India to ${destination} weighing ${weight} kg (${route.get('kind')==='documents'?'documents':'non-documents'}) via ${carrier==='SELF'?'Self managed ('+(route.get('selfService')||'service to confirm')+')':carrier}`;
      const drafts=[
        `I would like to book a shipment ${shipment}. Please contact me to confirm the details and arrange a pickup.`,
        `Please help me arrange a shipment ${shipment}. Kindly reach out to discuss the booking and pickup options.`,
        `I would like to send a shipment ${shipment}. Please get in touch to confirm the booking and schedule a pickup.`
      ];
      form.message.value=drafts[Math.floor(Math.random()*drafts.length)];
    }
    if(/^[1-9][0-9]{5}$/.test(fromPin)&&/^[1-9][0-9]{5}$/.test(toPin)&&Number.isFinite(weight)&&weight>0){
      form.message.value=`Please provide a domestic shipping quote.\nFrom PIN code: ${fromPin}\nTo PIN code: ${toPin}\nShipment type: ${route.get('kind')==='documents'?'Documents':'Parcel'}\nWeight: ${weight} kg`;
    }
  }
  if(path==='/pickup'){const now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;form.date.min=date;}
  const trap=document.createElement('input');trap.name='website';trap.tabIndex=-1;trap.autocomplete='off';trap.setAttribute('aria-hidden','true');trap.className='form-trap';form.append(trap);
  let requestKey=crypto.randomUUID();
  form.addEventListener('submit',async e=>{e.preventDefault();const values=Object.fromEntries(new FormData(form));const result=$('#request-result');if(path==='/pickup'&&values.date<form.date.min){result.innerHTML='<p class="form-error" role="alert">Choose today or a future pickup date.</p>';return;}
    const submit=$('button[type="submit"]',form);submit.disabled=true;
    try{if(config.requestEndpoint){const response=await fetch(config.requestEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,type:path==='/pickup'?'pickup':values.intent==='booking'?'booking':values.fromPin||values.weight||values.service==='Spot-rate enquiry'?'quotation':'enquiry',requestKey}),signal:AbortSignal.timeout(15000)});let receipt;try{receipt=await response.json();}catch{throw Error('The service returned an unreadable response. Your details are still here; please try again.');}if(!response.ok)throw Error(receipt?.error||'The request could not be sent. Your details are still in the form. Please try again.');if(!receipt||typeof receipt.reference!=='string')throw Error('Your request could not be confirmed. Please contact us before submitting again.');result.innerHTML=`<div class="request-success"><strong>Request received.</strong>${receipt.reference?`<p>Your reference: ${esc(receipt.reference)}</p>`:''}<p>Our team will review it. Collection and shipment acceptance still require confirmation.</p></div>`;form.reset();requestKey=crypto.randomUUID();}
      else{result.innerHTML='<div class="request-success"><strong>Your request is prepared.</strong><p>It has not been sent. Download a copy to share once contact details are available.</p><button type="button" class="text-link" id="download-request">Download your request ↓</button></div>';$('#download-request').addEventListener('click',()=>{const text=['ROYAL T COURIER — '+(path==='/pickup'?'PICKUP REQUEST':'ENQUIRY'),'Prepared locally; not submitted.','',...Object.entries(values).filter(([k])=>k!=='consent').map(([k,v])=>`${k.toUpperCase()}: ${v}`)].join('\n');const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='royal-t-request.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});}
    }catch(error){result.innerHTML=`<p class="form-error" role="alert">${esc(error.name==='TimeoutError'?'The request timed out. Your details are still here. Please contact us before submitting again.':error instanceof TypeError?'Unable to connect. Check your connection and try again.':error.message)}</p>`;}finally{submit.disabled=false;}
  });
}
render();
scrollToSection();
import('./assistant.js')
  .then(({ mountAssistant }) => mountAssistant())
  .catch(error => console.error('The website loaded, but the shipping assistant could not start.', error));
