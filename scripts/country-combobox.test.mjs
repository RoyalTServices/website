import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {bindCountryCombobox} from '../country-combobox.js';
test('one combobox filters in place and supports mouse, keyboard, clearing and no matches',()=>{
  const window=new Window();const previous=globalThis.document;globalThis.document=window.document;
  try{
    document.body.innerHTML='<label for="country">Country</label><input id="country" role="combobox" aria-expanded="false"><div id="options" role="listbox" hidden></div><p id="status"></p>';
    const input=document.querySelector('input'),list=document.querySelector('#options'),status=document.querySelector('#status');let changes=0;
    bindCountryCombobox(input,list,status,[{name:'India',code:'IN'},{name:'Indonesia',code:'ID'},{name:'United Kingdom',code:'GB'}],()=>{changes++;});
    input.focus();assert.equal(list.children.length,3);assert.equal(input.getAttribute('aria-expanded'),'true');
    input.value='ind';input.dispatchEvent(new window.Event('input'));assert.equal(list.children.length,2);
    input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowDown',cancelable:true}));
    assert.equal(input.getAttribute('aria-activedescendant'),list.children[0].id);
    input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowDown',cancelable:true}));
    input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',cancelable:true}));
    assert.equal(input.value,'Indonesia');assert.equal(list.hidden,true);assert.equal(input.getAttribute('aria-expanded'),'false');assert.equal(input.hasAttribute('aria-activedescendant'),false);
    input.value='gb';input.dispatchEvent(new window.Event('input'));assert.equal(list.children.length,1);list.children[0].click();assert.equal(input.value,'United Kingdom');
    input.value='';input.dispatchEvent(new window.Event('input'));assert.equal(list.children.length,3);
    input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',cancelable:true}));assert.equal(list.hidden,true);
    input.value='not-a-country';input.dispatchEvent(new window.Event('input'));assert.equal(list.hidden,true);assert.match(status.textContent,/No matching countries/);
    input.value='india';input.dispatchEvent(new window.Event('input'));input.blur();assert.equal(input.value,'India');assert.equal(list.hidden,true);assert.ok(changes>=6);
  }finally{globalThis.document=previous;window.happyDOM.abort();}
});
