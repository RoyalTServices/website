import test from 'node:test';
import assert from 'node:assert/strict';
import {renderEnquiry} from '../enquiry-view.js';
import {whatsappUrl} from '../whatsapp.js';
import {renderSite} from '../pages.js';
test('shipment and support details are readable and preserve nonempty nested data and zero values',()=>{
 const html=renderEnquiry({type:'assistant_issue',payload:{message:'Help',weight:2,declaredValue:0,receiver:{name:'Recipient',phone:'1234567890'},dimensions:{length:10,width:null},transcript:[{role:'customer',text:'<img src=x onerror=alert(1)>'}]}});
 assert.match(html,/Weight/);assert.match(html,/2 kg/);assert.match(html,/INR 0/);assert.match(html,/Name: Recipient/);assert.match(html,/Length: 10 cm/);assert.doesNotMatch(html,/null|\[object Object\]|<img/);assert.match(html,/&lt;img/);
});
test('WhatsApp template is included in both contact page and floating support link helper',()=>{
 const url=new URL(whatsappUrl('+91 9502295222'));assert.equal(url.pathname,'/919502295222');assert.match(url.searchParams.get('text'),/Pickup city \/ PIN/);assert.match(url.searchParams.get('text'),/Weight \(kg\)/);assert.match(renderSite('/contact'),/wa\.me\/919502295222\?text=/);
});
