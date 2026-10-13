import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url),target=new URL('supabase/functions/royalt-api/',root);
await fs.mkdir(target,{recursive:true});
for(const file of ['supabase-api.mjs','supabase-client.mjs','business-validation.mjs','courier-adapters.mjs'])await fs.copyFile(new URL(file,root),new URL(file,target));
console.log('Prepared Royal T Edge Function dependencies.');
