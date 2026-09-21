import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { createAwgDriver } from './createAwgDriver.js';
import { FilePeerMetadataStore } from './FilePeerMetadataStore.js';
import {
    PeerNotFoundError,
    PeerService,
} from './PeerService.js';

const app = new Hono();

const awg = createAwgDriver();
const metadata = new FilePeerMetadataStore();
const peers = new PeerService(awg, metadata);
await peers.restorePeers();

function normalizePeerName(name: unknown): string | null {
    if (typeof name !== 'string') {
        return null;
    }

    const normalized = name.trim();

    if (normalized.length === 0 || normalized.length > 100) {
        return null;
    }

    return normalized;
}

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
    let body: { name?: string };

    try {
        body = await c.req.json<{ name?: string }>();
    } catch {
        return c.json(
            {
                error: 'invalid JSON',
            },
            400,
        );
    }

    const name = normalizePeerName(body.name);

    if (!name) {
        return c.json(
            {
                error: 'name must be between 1 and 100 characters',
            },
            400,
        );
    }

    const peer = await peers.createPeer({ name });

    return c.json(peer, 201);
});

app.delete('/api/peers/:id', async (c) => {
    const id = c.req.param('id');

    await peers.removePeer(id);

    return c.body(null, 204);
});

app.patch('/api/peers/:id', async (c) => {
    const id = c.req.param('id');

    let body: { name?: string };

    try {
        body = await c.req.json<{ name?: string }>();
    } catch {
        return c.json(
            {
                error: 'invalid JSON',
            },
            400,
        );
    }

    const name = normalizePeerName(body.name);

    if (!name) {
        return c.json(
            {
                error: 'name must be between 1 and 100 characters',
            },
            400,
        );
    }

    await peers.renamePeer(id, name);

    return c.body(null, 204);
});

app.onError((error, c) => {
    if (error instanceof PeerNotFoundError) {
        return c.json(
            {
                error: error.message,
            },
            404,
        );
    }

    console.error(error);

    return c.json(
        {
            error: 'Internal Server Error',
        },
        500,
    );
});

serve({
    fetch: app.fetch,
    port: 3000,
});

console.log('amnezia-admin server: http://localhost:3000');
