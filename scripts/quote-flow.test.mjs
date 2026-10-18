import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {selfOptions,destinationChoices} from '../quote-options.js';
import {notifyRequest} from '../request-notification.mjs';
import {Window} from 'happy-dom';
const data=JSON.parse(await fs.readFile(new URL('../data/rates.json',import.meta.url)));
test('geographic prices require a known destination and ambiguous zones produce one enquiry',()=>{
  for(const country of ['Australia','Malaysia','New Zealand']){
    const options=selfOptions(data,country,'Other city / town');
    assert.equal(options.length,1);assert.ok(options[0].manualReason);
  }
  assert.equal(selfOptions(data,'New Zealand','Auckland')[0].route.name,'NEW ZEALAND (AKL)');
  assert.equal(selfOptions(data,'United Kingdom','Glasgow')[0].route.name,'Glasgow');
  assert.equal(selfOptions(data,'United Kingdom','England').length,1);
  assert.ok(destinationChoices(data,'United Kingdom').includes('Edinburgh'));
});
test('SMTP notification uses configured mailbox, fixed recipient and customer reply address',async()=>{
  let options,message,closed=false;
  const env={SMTP_HOST:'mail.example.com',SMTP_PORT:'587',SMTP_USER:'info@royaltservices.in',SMTP_PASS:'test-password'};
  const values={customer:{name:'Example',email:'customer@example.com'},payload:{type:'enquiry',city:'Sydney',message:'Help'}};
  const notification=await notifyRequest('RT-TEST',values,{env,createTransport:config=>{options=config;return {sendMail:async mail=>{message=mail;return {accepted:['info@royaltservices.in']};},close:()=>{closed=true;}};}});
  assert.equal(notification.status,'sent');assert.equal(options.host,env.SMTP_HOST);assert.equal(options.requireTLS,true);assert.equal(options.secure,false);assert.equal(options.auth.user,env.SMTP_USER);
  assert.equal(message.to,'info@royaltservices.in');assert.equal(message.replyTo,'customer@example.com');assert.match(message.text,/Sydney/);assert.equal(message.messageId,'<request-RT-TEST@royaltservices.in>');assert.equal(closed,true);
  assert.equal((await notifyRequest('RT-TEST',{}, {env:{}})).status,'unconfigured');
  assert.equal((await notifyRequest('RT-TEST',{}, {env,createTransport:()=>({sendMail:async()=>{throw Error('offline');},close(){}})})).status,'failed');
});
test('quote uses one country input, animates pending requests and narrows Self fares by city',async()=>{
  const window=new Window({url:'https://royalt.test/quote'});
  const names=['window','document','history','location','FormData','fetch','requestAnimationFrame','cancelAnimationFrame'];
  const previous=Object.fromEntries(names.map(key=>[key,globalThis[key]]));
  let complete,calls=0;
  const pending=new Promise(resolve=>{complete=resolve;});
  Object.assign(globalThis,{window,document:window.document,history:window.history,location:window.location,FormData:window.FormData,requestAnimationFrame:window.requestAnimationFrame.bind(window),cancelAnimationFrame:window.cancelAnimationFrame.bind(window),fetch:async()=>{calls++;await pending;return Response.json(data);}});
  document.body.innerHTML='<div id="app"></div>';
  try{
    await import('../app.js?quote-flow-test');
    assert.ok(document.querySelector('.courier-van'));
    assert.equal(document.querySelector('#country-search'),null);
    complete();await new Promise(resolve=>setTimeout(resolve,40));
    const country=document.querySelector('#country');country.value='United Kingdom';country.dispatchEvent(new window.Event('input'));
    const city=document.querySelector('#destination-city');city.value='Glasgow';city.dispatchEvent(new window.Event('change'));
    document.querySelector('#weight').value='2';
    document.querySelector('#quote-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
    assert.ok(document.querySelector('.courier-van'));
    await new Promise(resolve=>setTimeout(resolve,40));
    assert.equal(document.querySelectorAll('.rate-option').length,3);
    assert.match(document.querySelector('#quote-result').textContent,/Glasgow/);
    assert.equal(document.querySelector('#quote-result').getAttribute('aria-busy'),'false');
    assert.equal(calls,2);
  }finally{await window.happyDOM.abort();Object.assign(globalThis,previous);}
});
