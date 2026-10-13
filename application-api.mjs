import {supabaseApi} from './supabase-api.mjs';
import {internalApi} from './internal-api.mjs';
// Legacy storage is opt-in local development only. Production has one backend.
export function applicationApi(root,env=process.env) {
  return !env.VERCEL&&env.LEGACY_BACKEND==='true'?internalApi(root):supabaseApi({env});
}
