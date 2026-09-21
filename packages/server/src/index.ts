import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { createAwgDriver } from './createAwgDriver.js';
import { FilePeerMetadataStore } from './FilePeerMetadataStore.js';
import { PeerService } from './PeerService.js';

const app = new Hono();

const awg = createAwgDriver();
const metadata = new FilePeerMetadataStore();
const peers = new PeerService(awg, metadata);
await peers.restorePeers();

app.get('/', (c) => {
    return c.json({
        name: 'amnezia-admin',
        status: 'ok',
    });
});

app.get('/api/status', async (c) => {
    const status = await awg.getRawStatus();

    return c.json({
        status,
    });
});

app.get('/api/peers', async (c) => {
    return c.json(await peers.listPeers());
});

app.post('/api/peers', async (c) => {
    const body = await c.req.json<{
        name?: string;
    }>();

    if (!body.name) {
        return c.json(
            {
                error: 'name is required',
            },
            400,
        );
    }

    const peer = await peers.createPeer({
        name: body.name,
    });

    return c.json(peer, 201);
});

app.delete('/api/peers/:publicKey', async (c) => {
    const publicKey = c.req.param('publicKey');

    await peers.removePeer(publicKey);

    return c.body(null, 204);
});

serve({
    fetch: app.fetch,
    port: 3000,
});

console.log('amnezia-admin server: http://localhost:3000');
