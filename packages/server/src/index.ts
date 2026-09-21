import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { MockAwgDriver } from './MockAwgDriver.js';

const app = new Hono();
const awg = new MockAwgDriver();

app.get('/', (c) => {
    return c.json({
        name: 'amnezia-admin',
        status: 'ok',
    });
});

app.get('/api/peers', async (c) => {
    const peers = await awg.listPeers();

    return c.json(peers);
});

serve({
    fetch: app.fetch,
    port: 3000,
});

console.log('amnezia-admin server: http://localhost:3000');
