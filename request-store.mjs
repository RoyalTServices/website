import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const empty = () => ({admin:null,records:[],sessions:{},attempts:{}});
const unavailable = (status=503) => Object.assign(new Error('Shipment storage is unavailable. Please try again or contact the administrator.'),{status});
function validate(store) {
  if(!store || !Array.isArray(store.records) || (store.admin && (!/^[a-f0-9]{128}$/.test(store.admin.hash) || !/^[a-f0-9]{32}$/.test(store.admin.salt)))) throw unavailable(500);
  store.sessions ||= {}; store.attempts ||= {};
  return store;
}

// A locked database row keeps updates atomic across separate Vercel instances.
export function postgresStore(pool) {
  let ready;
  async function init() {
    if(!ready) ready=(async()=>{
      await pool.query('CREATE TABLE IF NOT EXISTS royalt_store (id integer PRIMARY KEY CHECK (id = 1), data jsonb NOT NULL)');
      await pool.query('INSERT INTO royalt_store (id, data) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING',[JSON.stringify(empty())]);
    })().catch(error=>{ready=undefined;throw error;});
    await ready;
  }
  return {
    async read() {try {await init();const result=await pool.query('SELECT data FROM royalt_store WHERE id = 1');return validate(result.rows[0]?.data);} catch {throw unavailable();}},
    async mutate(operation) {
      let client,operationError;
      try {
        await init();client=await pool.connect();await client.query('BEGIN');
        await client.query("SET LOCAL statement_timeout = '10000'");
        const result=await client.query('SELECT data FROM royalt_store WHERE id = 1 FOR UPDATE');
        const store=validate(result.rows[0]?.data);let value;
        try {value=await operation(store);}catch(error){operationError=error;throw error;}
        await client.query('UPDATE royalt_store SET data = $1::jsonb WHERE id = 1',[JSON.stringify(store)]);
        await client.query('COMMIT');return value;
      } catch(error) {
        if(client) await client.query('ROLLBACK').catch(()=>{});
        if(error===operationError)throw error;
        throw unavailable();
      } finally {client?.release();}
    }
  };
}

export function requestStore(root,{databaseUrl=process.env.DATABASE_URL || process.env.POSTGRES_URL,vercel=process.env.VERCEL,storePath=process.env.INTERNAL_STORE_PATH || path.join(root,'data','internal-store.json')}={}) {
  if(databaseUrl) {
    const pool=new pg.Pool({connectionString:databaseUrl,max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,allowExitOnIdle:true});
    // Errors on idle connections must not crash the function or disclose credentials.
    pool.on('error',()=>{});
    return postgresStore(pool);
  }
  if(vercel) return {read:async()=>{throw unavailable();},mutate:async()=>{throw unavailable();}};
  let queue=Promise.resolve();
  const read=async()=>{try{return validate(JSON.parse(await fs.readFile(storePath,'utf8')));}catch(error){if(error.code==='ENOENT')return empty();throw unavailable(500);}};
  return {read,mutate(operation){const task=queue.then(async()=>{const store=await read(),result=await operation(store);await fs.mkdir(path.dirname(storePath),{recursive:true});await fs.writeFile(storePath+'.tmp',JSON.stringify(store,null,2),{mode:0o600});await fs.rename(storePath+'.tmp',storePath);return result;});queue=task.catch(()=>{});return task;}};
}
