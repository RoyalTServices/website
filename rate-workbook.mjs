import ExcelJS from 'exceljs';
import {failure} from './business-validation.mjs';

export const rateMime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const headers={Settings:['key','value'],Destinations:['name','code','UPS zone','DHL zone'],Rates:['carrier','kind','zone','weight kg','band min exclusive','band max inclusive','amount INR'],Self:['country','service','group','first 0.5 kg INR','additional 0.5 kg INR','6+ INR/kg','8+ INR/kg','11+ INR/kg','16+ INR/kg','21+ INR/kg','26+ INR/kg','maximum kg','notes']};
const bad=message=>{throw failure(message);};
export async function createRateWorkbook(data){
  const book=new ExcelJS.Workbook();
  const help=book.addWorksheet('Instructions');
  for(const text of ['Royal T Courier — price list format v1','Keep sheet names and column headings unchanged. Download this file, edit prices and effective dates, then upload the complete workbook.','Settings: start dates use YYYY-MM-DD. Leave validUntil and selfValidUntil blank to keep rates valid until replaced; optionally enter an expiry date. validFrom / validUntil apply to the whole DHL/UPS list.','Destinations: preserve the carrier zone mappings unless verified. Blank zone means enquiry only.','Rates: documents/parcels use weight kg, leaving band columns blank. bands use exclusive minimum and inclusive maximum; their amount is INR per kg.','Self: first/additional half kg below 6 kg; from 6 kg round up to a whole kg and use the applicable threshold. Blank price means enquiry, never zero.','Self services with regional/duty/content restrictions must retain clear service names and notes. The maximum is the total shipment limit; box limits remain in notes.','All amounts are positive INR values. Use numbers, not formulas, currency symbols or commas.','Uploading replaces ALL three services. Only the newest three uploaded Excel files are retained in private Supabase Storage.'])help.addRow([text]);
  help.getColumn(1).width=120;
  const sheets={};for(const [name,columns]of Object.entries(headers)){const s=book.addWorksheet(name);s.addRow(columns);s.views=[{state:'frozen',ySplit:1}];s.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};s.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF184CA0'}};s.columns.forEach((c,i)=>c.width=i===0?28:22);sheets[name]=s;}
  for(const [key,value]of Object.entries({format:'royalt-rates-v1',validFrom:data.validFrom,validUntil:data.validUntil||'',selfValidFrom:data.SELF.validFrom,selfValidUntil:data.SELF.validUntil||''}))sheets.Settings.addRow([key,value]);
  sheets.Settings.getColumn(2).numFmt='@';
  for(const c of data.countries)sheets.Destinations.addRow([c.name,c.code,c.zone,c.dhlZone]);
  for(const carrier of ['DHL','UPS'])for(const kind of ['documents','parcels','bands'])for(const row of data[carrier][kind])for(const [zone,amount]of Object.entries(row.rates))sheets.Rates.addRow([carrier,kind,zone,row.weight??null,row.min??null,row.max??null,amount]);
  for(const r of data.SELF.routes)sheets.Self.addRow([r.country,r.name,r.group,r.base,r.additional,...r.bands.map(b=>b.amount),r.maxWeight,r.notes]);
  return Buffer.from(await book.xlsx.writeBuffer());
}
export async function parseRateWorkbook(bytes){
  if(bytes.length>1500000||bytes.length<4||bytes[0]!==80||bytes[1]!==75)bad('Upload an Excel .xlsx price list under 1.5 MB.');
  // Bound the declared expanded ZIP size before parsing an untrusted workbook.
  let expanded=0,entries=0;for(let i=0;i<bytes.length-46;i++)if(bytes.readUInt32LE(i)===0x02014b50){expanded+=bytes.readUInt32LE(i+24);entries++;}
  if(!entries||entries>100||expanded>16000000)bad('The workbook is too large or contains unsupported content.');
  const book=new ExcelJS.Workbook();try{await book.xlsx.load(bytes);}catch{bad('The Excel file could not be read. Download a fresh template.');}
  const rows={};for(const [name,columns]of Object.entries(headers)){
    const sheet=book.getWorksheet(name);if(!sheet||sheet.rowCount>12000)bad(`Missing or oversized ${name} sheet.`);
    if(columns.some((v,i)=>sheet.getCell(1,i+1).value!==v))bad(`Keep the ${name} column headings unchanged.`);
    rows[name]=[];sheet.eachRow((row,n)=>{if(n===1)return;const values=columns.map((_,i)=>row.getCell(i+1).value??'');if(values.every(v=>v===''))return;if(values.some(v=>typeof v==='object'))bad(`${name} row ${n}: formulas and rich values are not supported. Paste numbers or plain text.`);rows[name].push(values);});
  }
  const settings=Object.fromEntries(rows.Settings);if(settings.format!=='royalt-rates-v1')bad('Use the Royal T price-list template.');
  const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
  if(!date(settings.validFrom)||settings.validUntil&&(!date(settings.validUntil)||settings.validFrom>settings.validUntil)||!date(settings.selfValidFrom)||settings.selfValidUntil&&(!date(settings.selfValidUntil)||settings.selfValidUntil<settings.selfValidFrom))bad('Check the effective dates in Settings. Use YYYY-MM-DD; expiry dates may be blank for rates valid until replaced.');
  const text=(v,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)bad('Names and notes must be plain text within the allowed length.');return v.trim();};
  const amount=v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<=0||v>100000000)bad('Prices and weights must be positive numbers. Blank prices require an enquiry.');return v;};
  const optional=v=>v===''?null:amount(v);
  const data={validFrom:settings.validFrom,validUntil:settings.validUntil||null,countries:[],DHL:{documents:[],parcels:[],bands:[]},UPS:{documents:[],parcels:[],bands:[]},SELF:{validFrom:settings.selfValidFrom,validUntil:settings.selfValidUntil||null,routes:[]}};
  const names=new Set();for(const [name,code,ups,dhl]of rows.Destinations){const n=text(name);if(names.has(n.toLowerCase()))bad(`Duplicate destination: ${n}.`);names.add(n.toLowerCase());data.countries.push({name:n,code:text(String(code)),zone:ups===''?null:String(ups),dhlZone:dhl===''?null:String(dhl)});}
  if(!names.size)bad('Add at least one destination.');
  const seen=new Set();for(const [carrier,kind,z,w,min,max,price]of rows.Rates){if(!['DHL','UPS'].includes(carrier)||!['documents','parcels','bands'].includes(kind))bad('Rates must use DHL / UPS and documents / parcels / bands.');const zone=text(String(z),10),key=[carrier,kind,zone,w,min,max].join('|');if(seen.has(key))bad('Remove duplicate rate rows.');seen.add(key);
    let row;if(kind==='bands'){if(w!==''||typeof min!=='number'||min<0||amount(max)<=min||max>99999)bad('Check the band limits.');row=data[carrier].bands.find(r=>r.min===min&&r.max===max);if(!row){row={min,max,rates:{}};data[carrier].bands.push(row);}}
    else{if(min!==''||max!==''||amount(w)>99999)bad('Slab rows need only weight kg.');row=data[carrier][kind].find(r=>r.weight===w);if(!row){row={weight:w,rates:{}};data[carrier][kind].push(row);}}row.rates[zone]=amount(price);
  }
  for(const carrier of ['DHL','UPS']){for(const kind of ['documents','parcels','bands']){const list=data[carrier][kind];if(!list.length)bad(`The ${carrier} ${kind} rates are missing.`);list.sort((a,b)=>(a.weight??a.min)-(b.weight??b.min));if(kind==='bands')for(let i=1;i<list.length;i++)if(list[i].min<list[i-1].max)bad(`Overlapping ${carrier} weight bands.`);}if(data[carrier].bands[0].min<data[carrier].parcels.at(-1).weight)bad(`Overlapping ${carrier} parcel slabs and bands.`);}
  const selfSeen=new Set();for(const [country,name,group,base,additional,...rest]of rows.Self){if(!names.has(String(country).toLowerCase()))bad(`Self country must match Destinations: ${country}.`);const key=country+'|'+name;if(selfSeen.has(key))bad('Duplicate Self service.');selfSeen.add(key);const bands=rest.slice(0,6).map((v,i)=>({min:[6,8,11,16,21,26][i],amount:optional(v)}));data.SELF.routes.push({country:text(country),name:text(name),group:group?text(group):'',base:optional(base),additional:optional(additional),bands,maxWeight:amount(rest[6]),notes:rest[7]?text(rest[7],12000):''});}
  if(!data.SELF.routes.length)bad('The Self sheet is empty.');
  return data;
}
