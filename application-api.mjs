import {supabaseApi} from './supabase-api.mjs';
import {internalApi} from './internal-api.mjs';
import {edgeRelay} from './edge-relay.mjs';
import {productionBackend} from './backend-config.mjs';
// Legacy storage is opt-in local development only. Production has one backend.
export function applicationApi(root,env=process.env) {
  if(!env.VERCEL&&env.LEGACY_BACKEND==='true')return internalApi(root);
  if(env.VERCEL_ENV==='production'&&!env.SUPABASE_SECRET_KEY&&!env.SUPABASE_SERVICE_ROLE_KEY)env={...productionBackend,...env};
  if(env.SUPABASE_EDGE_URL)return edgeRelay(env);
  return supabaseApi({env});
}
