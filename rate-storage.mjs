import {randomUUID} from 'node:crypto';
import {createRateWorkbook,parseRateWorkbook,rateMime} from './rate-workbook.mjs';
import {failure} from './business-validation.mjs';
import {initialRateWorkbook} from './rate-seed.mjs';
const bucket='royalt-rate-lists';
const check=({data,error})=>{if(error)throw failure('Price-list storage is unavailable. Please retry.',503);return data;};
let cachedPath='',cachedRates;
let parsedSeed;
export async function currentRates(service){
  const state=check(await service.from('royalt_rate_state').select('active_path,updated_by').eq('id',1).single());
  if(!state.active_path){
    await rateStorage(service,{id:null},'POST',{action:'upload',name:'initial-rates.xlsx',base64:initialRateWorkbook},{bootstrap:true});
    return currentRates(service);
  }
  if(cachedPath===state.active_path)return cachedRates;
  const blob=check(await service.storage.from(bucket).download(state.active_path));
  const data=await parseRateWorkbook(Buffer.from(await blob.arrayBuffer()));
  // Refresh bundled initial prices only until the first staff publication. Staff uploads always win.
  if(!state.updated_by){
    parsedSeed ||= await parseRateWorkbook(Buffer.from(initialRateWorkbook,'base64'));
    if(JSON.stringify(data)!==JSON.stringify(parsedSeed)){
      await rateStorage(service,{id:null},'POST',{action:'upload',name:'initial-rates.xlsx',base64:initialRateWorkbook},{bootstrap:true,expectedPath:state.active_path});
      return currentRates(service);
    }
  }
  cachedPath=state.active_path;cachedRates=data;return data;
}
export async function rateStorage(service,profile,method,values={},{bootstrap=false,expectedPath=null}={}){
  const store=service.storage.from(bucket);
  if(method==='GET'){
    const state=check(await service.from('royalt_rate_state').select('active_path').eq('id',1).single());
    const files=check(await store.list('',{limit:1000,sortBy:{column:'name',order:'desc'}}));
    return {files:files.filter(f=>f.name.endsWith('.xlsx')).map(f=>({name:f.name,createdAt:f.created_at,active:f.name===state.active_path})),retained:3};
  }
  if(values.action==='download'){
    if(typeof values.path!=='string'||!/^[a-zA-Z0-9.-]+\.xlsx$/.test(values.path))throw failure('Choose a valid saved file.');
    const blob=check(await store.download(values.path));return {name:values.path,base64:Buffer.from(await blob.arrayBuffer()).toString('base64')};
  }
  if(values.action==='template'){
    const data=await currentRates(service);return {name:'royal-t-price-list-template.xlsx',base64:(await createRateWorkbook(data)).toString('base64')};
  }
  if(values.action==='cleanup'){
    const token=randomUUID();
    if(!check(await service.rpc('royalt_claim_rate_upload',{p_token:token})))throw failure('Another price list is being published. Please retry shortly.',409);
    try{
      const files=check(await store.list('',{limit:1000,sortBy:{column:'name',order:'desc'}}));
      const old=files.filter(f=>f.name.endsWith('.xlsx')).slice(3).map(f=>f.name);
      if(old.length)check(await store.remove(old));return {ok:true,message:'Only the latest three Excel files are retained.'};
    }finally{await service.rpc('royalt_release_rate_upload',{p_token:token});}
  }
  if(values.action!=='upload'||typeof values.base64!=='string'||values.base64.length>2000000||!/^[-\w .()]+\.xlsx$/i.test(values.name||''))throw failure('Choose an .xlsx price list under 1.5 MB.');
  const bytes=Buffer.from(values.base64,'base64'),data=await parseRateWorkbook(bytes);
  const token=randomUUID();
  if(!check(await service.rpc('royalt_claim_rate_upload',{p_token:token})))throw failure('Another price list is being published. Please retry shortly.',409);
  const path=new Date().toISOString().replace(/[:]/g,'-')+'-'+randomUUID()+'.xlsx';let uploaded=false,published=false;
  try{
    if(bootstrap){const state=check(await service.from('royalt_rate_state').select('active_path,updated_by').eq('id',1).single());if(state.active_path&&(!expectedPath||state.active_path!==expectedPath||state.updated_by))return {ok:true};}
    check(await store.upload(path,bytes,{contentType:rateMime,upsert:false}));uploaded=true;
    // Publish only after validation. The lock serializes upload, activation and pruning.
    check(await service.rpc('royalt_publish_rates',{p_token:token,p_path:path,p_staff:profile.id}));published=true;
    const files=check(await store.list('',{limit:1000,sortBy:{column:'name',order:'desc'}}));
    const old=files.filter(f=>f.name.endsWith('.xlsx')).slice(3).map(f=>f.name);
    if(old.length)check(await store.remove(old));
    return {ok:true,message:'Price list published. The latest three Excel files are retained.',validUntil:data.validUntil};
  }catch(error){if(uploaded&&!published)await store.remove([path]);if(published)throw failure('The new list is active, but old-file cleanup failed. Refresh and contact your administrator to retry cleanup.',503);throw error;}
  finally{await service.rpc('royalt_release_rate_upload',{p_token:token});}
}
