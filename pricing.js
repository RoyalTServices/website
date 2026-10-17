export function calculateRate(data, carrier, country, kind, weight) {
  if (!Number.isFinite(weight) || weight <= 0) return {manual:true,reason:'Enter a valid chargeable weight.'};
  if(carrier==='SELF')return calculateSelfRate(country,weight);
  const zone = carrier === 'DHL' ? ('dhlZone' in country ? country.dhlZone : data.DHL.countryZones?.[country.code]) : country.zone;
  if (!zone) return {manual:true,reason:`A ${carrier} destination mapping needs confirmation. Please request a rate.`};
  const rate = data[carrier];
  if (carrier === 'UPS' && weight >= 300) return {manual:true,reason:'A spot-rate enquiry is needed for this weight.'};
  const table = kind === 'documents' && weight <= rate.documents.at(-1).weight ? rate.documents : rate.parcels;
  const row = table.find(r => r.weight >= weight);
  if (row && row.rates[zone] != null) return {amount:row.rates[zone],chargedWeight:row.weight,zone};
  if (row) return {manual:true,reason:'A destination-specific rate needs confirmation.'};
  const rounded = Math.ceil(weight);
  const band = rate.bands.find(b => rounded > b.min && rounded <= b.max);
  if (band && band.rates[zone] != null) return {amount:Math.round(band.rates[zone] * rounded * 100) / 100,chargedWeight:rounded,zone};
  return {manual:true,reason:'Please request a rate for this shipment.'};
}

export function calculateSelfRate(route,weight){
  if(!Number.isFinite(weight)||weight<=0||weight>route.maxWeight)return {manual:true,reason:`This service requires a shipment review above ${route.maxWeight} kg.`};
  if(/SUSPENDED/i.test(route.notes))return {manual:true,reason:'This service is suspended in the supplied price list.'};
  const chargedWeight=weight<6?Math.ceil(weight*2)/2:Math.ceil(weight);
  let amount;
  if(chargedWeight<6){if(route.base>0&&(chargedWeight===.5||route.additional>0))amount=route.base+(chargedWeight/.5-1)*route.additional;}
  else{const band=route.bands.filter(b=>b.min<=chargedWeight).at(-1);if(band?.amount>0)amount=band.amount*chargedWeight;}
  return Number.isFinite(amount)?{amount:Math.round(amount*100)/100,chargedWeight}:{manual:true,reason:'A price is not supplied for this service and weight. Please request a rate.'};
}
