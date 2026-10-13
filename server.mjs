import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSiteServer} from './site-server.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
createSiteServer(root).listen(port,'127.0.0.1',() => console.log(`Royal T preview: http://localhost:${port}`));
