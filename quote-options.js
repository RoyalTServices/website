// Only explicit destination mappings may select a geographic price.
export function destinationChoices(data, country) {
  const routes=(data.SELF?.routes||[]).filter(route=>route.country===country);
  if(country==='New Zealand'&&routes.length>1)return ['Auckland','Other city / town'];
  if(country==='United Kingdom'&&routes.length>1)return ['England','Glasgow','Edinburgh','Other Scotland','Northern Ireland','Isle of Man / Isle of Wight','Jersey / Guernsey / Channel Islands'];
  return [];
}
export function selfOptions(data,country,city='') {
  let routes=(data.SELF?.routes||[]).filter(route=>route.country===country);
  if(!routes.length)return [];
  if(country==='United Kingdom'&&routes.length>1){
    const names={'England':'United Kingdom','Glasgow':'Glasgow','Edinburgh':'Edinburgh','Other Scotland':'Scotland','Northern Ireland':'Northern Ireland(BT1-BT99)','Isle of Man / Isle of Wight':'Isle of Man / Wight','Jersey / Guernsey / Channel Islands':'JERSEY / GUERNSEY / CHANNEL ISLAND'};
    routes=routes.filter(r=>r.name.replace(/\s+/g,' ').trim()===names[city]);
  } else if(country==='New Zealand'&&routes.length>1){
    routes=city==='Auckland'?routes.filter(r=>r.name==='NEW ZEALAND (AKL)'):[];
  }
  if(!routes.length||routes.some(r=>/^Zone-\d+$/i.test(r.name))||routes.some(r=>/REMOTE/i.test(r.name))){
    return [{carrier:'SELF',label:'Royal T delivery',manualReason:'Share your destination city and postcode for a confirmed Royal T rate.',route:null}];
  }
  const seen=new Set();
  return routes.filter(r=>{const key=JSON.stringify([r.name,r.base,r.additional,r.bands,r.maxWeight]);if(seen.has(key))return false;seen.add(key);return true;}).map(route=>({carrier:'SELF',route,label:routes.length>1?route.name:city||'Royal T delivery'}));
}
