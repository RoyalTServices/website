// Shared invoice validation/calculation. Amounts are stored and added in integer paise.
export const gstStates={'01':'Jammu and Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat','26':'Dadra and Nagar Haveli and Daman and Diu','27':'Maharashtra','29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman and Nicobar Islands','36':'Telangana','37':'Andhra Pradesh','38':'Ladakh','99':'Outside India'};
const fail=m=>{throw Error(m);};
const txt=(v,label,max=200,required=true)=>{const s=String(v??'').trim();if(required&&!s||s.length>max)fail(`Enter ${label}${required?'':' within the allowed length'}.`);return s;};
export function validGstin(value){
  const s=String(value||'').trim().toUpperCase(),chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if(!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(s)||!gstStates[s.slice(0,2)]||s.startsWith('99'))return false;
  let factor=2,sum=0;for(let i=13;i>=0;i--){const n=chars.indexOf(s[i])*factor;sum+=Math.floor(n/36)+n%36;factor=factor===2?1:2;}return chars[(36-sum%36)%36]===s[14];
}
export function decimalUnits(value,places,label){
  const s=String(value??'').trim();if(!new RegExp('^\\d{1,10}(?:\\.\\d{1,'+places+'})?$').test(s))fail(`Enter a valid ${label} with up to ${places} decimals.`);
  const [whole,fraction='']=s.split('.'),n=Number(whole)*10**places+Number(fraction.padEnd(places,'0'));
  if(!Number.isSafeInteger(n)||n>10000000000)fail(`${label} is too large.`);return n;
}
export function businessDetails(v){
  const d={};for(const [k,label,max,required]of [['businessName','business name',150,true],['tradeName','trading name',150,false],['address','business address',1000,true],['phone','business phone',30,false],['email','business email',150,false],['postalCode','postal code',6,false],['bankName','bank name',100,false],['bankAccount','bank account',40,false],['ifsc','IFSC',11,false],['upi','UPI ID',100,false],['terms','payment terms',1500,false],['signatory','authorised signatory',120,false]])d[k]=txt(v[k],label,max,required);
  d.gstin=txt(v.gstin,'a valid GSTIN',15).toUpperCase();if(!validGstin(d.gstin))fail('Enter a valid business GSTIN, including its check digit.');
  d.stateCode=String(v.stateCode||'');if(!gstStates[d.stateCode]||d.stateCode==='99'||d.gstin.slice(0,2)!==d.stateCode)fail('The business state must match the GSTIN state code.');
  d.invoicePrefix=String(v.invoicePrefix||'RTC').trim().toUpperCase();if(!/^[A-Z0-9]{1,4}$/.test(d.invoicePrefix))fail('Use 1–4 letters or digits for the invoice prefix.');
  d.sac=String(v.sac||'').trim();if(!/^\d{6}$/.test(d.sac))fail('Enter the 6-digit SAC confirmed for your service.');
  const tax=decimalUnits(v.defaultTaxRate,2,'default GST rate');if(tax>10000)fail('GST rate must be between 0 and 100%.');d.defaultTaxRate=tax/100;
  if(!['inclusive','exclusive'].includes(v.priceMode))fail('Choose whether prices include GST.');d.priceMode=v.priceMode;
  if(d.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))fail('Enter a valid business email.');
  if(d.postalCode&&!/^[1-9]\d{5}$/.test(d.postalCode))fail('Enter a valid 6-digit business PIN code.');
  d.ifsc=d.ifsc.toUpperCase();if(d.ifsc&&!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(d.ifsc))fail('Enter a valid IFSC.');return d;
}
export function invoiceCalculation(input,sellerInput){
  const seller=businessDetails(sellerInput),buyer={name:txt(input.buyerName,'customer billing name',150),address:txt(input.buyerAddress,'customer billing address',1000),gstin:txt(input.buyerGstin,'customer GSTIN',15,false).toUpperCase(),stateCode:String(input.buyerStateCode||''),country:txt(input.buyerCountry||'India','customer country',100)};
  if(!gstStates[buyer.stateCode])fail('Choose the customer billing state.');if(buyer.gstin&&(!validGstin(buyer.gstin)||buyer.gstin.slice(0,2)!==buyer.stateCode))fail('Customer GSTIN is invalid or does not match the billing state.');
  const placeOfSupply=String(input.placeOfSupply||''),treatment=input.treatment||'regular',priceMode=input.priceMode;
  if(!['regular','export_lut','export_igst'].includes(treatment))fail('Choose a valid supply treatment.');
  const exported=treatment!=='regular';if(exported&&(placeOfSupply!=='99'||buyer.stateCode!=='99'||buyer.country.toLowerCase()==='india'))fail('Export invoices need an overseas customer, country and place of supply.');
  if(!exported&&(!gstStates[placeOfSupply]||placeOfSupply==='99'||buyer.stateCode==='99'||buyer.country.toLowerCase()!=='india'))fail('Choose Indian billing and place-of-supply states for a regular GST invoice.');
  const lutReference=txt(input.lutReference,'LUT / bond reference',120,treatment==='export_lut');
  const reverseCharge=input.reverseCharge===true||input.reverseCharge==='yes';if(reverseCharge&&(exported||!buyer.gstin))fail('Reverse-charge invoices require a registered Indian recipient.');
  if(!['inclusive','exclusive'].includes(priceMode))fail('Choose whether line prices include GST.');
  if(reverseCharge&&priceMode!=='exclusive')fail('Use GST-exclusive line prices for reverse-charge invoices.');
  if(!Array.isArray(input.items)||!input.items.length||input.items.length>25)fail('Add between 1 and 25 invoice lines.');
  const local=!exported&&seller.stateCode===placeOfSupply,localTax=['04','26','31','35','38'].includes(seller.stateCode)?'UTGST':'SGST';
  const items=input.items.map((item,index)=>{
    const description=txt(item.description,`description for line ${index+1}`,500),sac=String(item.sac||'');if(!/^\d{6}$/.test(sac))fail(`Enter a 6-digit SAC for line ${index+1}.`);
    const quantityMilli=decimalUnits(item.quantity,3,'quantity');if(quantityMilli<1||quantityMilli>9999000)fail('Quantity must be between 0.001 and 9999.');
    const ratePaise=decimalUnits(item.rate,2,'unit price'),discountPaise=decimalUnits(item.discount||0,2,'line discount'),gstBasisPoints=decimalUnits(item.gstRate,2,'GST rate');if(gstBasisPoints>10000)fail('GST rate must be between 0 and 100%.');
    if(treatment==='export_lut'&&gstBasisPoints!==0)fail('Use 0% collected GST for an export under LUT / bond.');
    const grossPaise=Math.round(ratePaise*quantityMilli/1000);if(!Number.isSafeInteger(grossPaise)||grossPaise>10000000000||discountPaise>grossPaise)fail('Check line amount and discount.');
    const net=grossPaise-discountPaise,taxablePaise=priceMode==='inclusive'&&!reverseCharge?Math.round(net*10000/(10000+gstBasisPoints)):net;
    const cgstPaise=local?Math.round(taxablePaise*gstBasisPoints/20000):0,stateTaxPaise=local?cgstPaise:0,igstPaise=local?0:Math.round(taxablePaise*gstBasisPoints/10000),taxPaise=cgstPaise+stateTaxPaise+igstPaise;
    const roundOffPaise=priceMode==='inclusive'&&!reverseCharge?net-taxablePaise-taxPaise:0,totalPaise=taxablePaise+(reverseCharge?0:taxPaise)+roundOffPaise;
    return {description,sac,quantityMilli,ratePaise,discountPaise,grossPaise,taxablePaise,gstBasisPoints,cgstPaise,stateTaxPaise,igstPaise,taxPaise,roundOffPaise,totalPaise};
  });
  const totals={};for(const key of ['grossPaise','discountPaise','taxablePaise','cgstPaise','stateTaxPaise','igstPaise','taxPaise','roundOffPaise','totalPaise'])totals[key]=items.reduce((sum,item)=>sum+item[key],0);
  if(totals.totalPaise<=0||totals.totalPaise>10000000000)fail('Invoice total must be positive and no greater than ₹10 crore.');
  return {seller,buyer,placeOfSupply,treatment,priceMode,reverseCharge,lutReference,localTax:local?localTax:null,items,totals,deliveryAddress:txt(input.deliveryAddress||buyer.address,'delivery address',1000),notes:txt(input.notes,'invoice notes',1500,false)};
}
