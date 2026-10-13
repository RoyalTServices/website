export function calculateRate(data, carrier, country, kind, weight) {
  if (!Number.isFinite(weight) || weight <= 0) return {manual:true,reason:'Enter a valid chargeable weight.'};
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
