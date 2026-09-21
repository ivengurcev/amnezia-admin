import { serve } from '@hono/node-server';

import { createApp } from './app.js';
import { createAwgDriver } from './createAwgDriver.js';
import { FilePeerMetadataStore } from './FilePeerMetadataStore.js';
import { PeerService } from './PeerService.js';

const awg = createAwgDriver();
const metadata = new FilePeerMetadataStore();
const peers = new PeerService(awg, metadata);
await peers.restorePeers();
const app = createApp(awg, peers);

serve({
    fetch: app.fetch,
    port: 3000,
});

console.log('amnezia-admin server: http://localhost:3000');
