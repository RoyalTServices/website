export function whatsappUrl(number) {
  const message='Hello Royal T Courier,\nI would like help with a shipment.\n\nService needed: \nPickup city / PIN: \nDestination city / country: \nContents: \nWeight (kg): \nPreferred pickup date: ';
  return `https://wa.me/${String(number||'').replace(/\D/g,'')}?text=${encodeURIComponent(message)}`;
}
