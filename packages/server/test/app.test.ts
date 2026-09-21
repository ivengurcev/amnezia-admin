import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { PeerService } from '../src/PeerService.js';
import {
    InMemoryAwgDriver,
    InMemoryPeerMetadataStore,
    peerMetadata,
    peerStatus,
} from './fakes.js';

function setup(
    awg = new InMemoryAwgDriver(),
    metadata = new InMemoryPeerMetadataStore(),
) {
    const peers = new PeerService(awg, metadata);

    return {
        app: createApp(awg, peers),
        awg,
        metadata,
    };
}

describe('HTTP API', () => {
    it('returns service status from GET /', async () => {
        const { app } = setup();

        const response = await app.request('/');

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            name: 'amnezia-admin',
            status: 'ok',
        });
    });

    it('returns peers from GET /api/peers', async () => {
        const { app } = setup(
            new InMemoryAwgDriver([peerStatus()]),
            new InMemoryPeerMetadataStore([peerMetadata()]),
        );

        const response = await app.request('/api/peers');

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual([
            peerStatus({
                id: '11111111-1111-4111-8111-111111111111',
                name: 'Saved peer',
            }),
        ]);
    });

    it('creates a peer through POST /api/peers', async () => {
        const { app } = setup();

        const response = await app.request('/api/peers', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'New phone' }),
        });

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toMatchObject({
            name: 'New phone',
            address: '10.90.0.2',
            publicKey: 'test-public-key-1',
        });
    });

    it('renames a peer through PATCH /api/peers/:id', async () => {
        const metadata = new InMemoryPeerMetadataStore([
            peerMetadata(),
        ]);
        const { app } = setup(
            new InMemoryAwgDriver(),
            metadata,
        );

        const response = await app.request(
            '/api/peers/11111111-1111-4111-8111-111111111111',
            {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'Renamed phone' }),
            },
        );

        expect(response.status).toBe(204);
        await expect(
            metadata.getById(
                '11111111-1111-4111-8111-111111111111',
            ),
        ).resolves.toMatchObject({ name: 'Renamed phone' });
    });

    it('deletes a peer through DELETE /api/peers/:id', async () => {
        const awg = new InMemoryAwgDriver([peerStatus()]);
        const metadata = new InMemoryPeerMetadataStore([
            peerMetadata(),
        ]);
        const { app } = setup(awg, metadata);

        const response = await app.request(
            '/api/peers/11111111-1111-4111-8111-111111111111',
            { method: 'DELETE' },
        );

        expect(response.status).toBe(204);
        await expect(awg.listPeers()).resolves.toEqual([]);
        await expect(metadata.list()).resolves.toEqual([]);
    });

    it.each([
        ['PATCH', { name: 'New name' }],
        ['DELETE', undefined],
    ])(
        'returns 404 when %s targets a missing peer',
        async (method, body) => {
            const { app } = setup();

            const response = await app.request(
                '/api/peers/missing-id',
                {
                    method,
                    headers: body
                        ? { 'content-type': 'application/json' }
                        : undefined,
                    body: body ? JSON.stringify(body) : undefined,
                },
            );

            expect(response.status).toBe(404);
            await expect(response.json()).resolves.toEqual({
                error: 'Peer not found: missing-id',
            });
        },
    );

    it.each([
        ['', 'an empty name'],
        ['   ', 'a whitespace-only name'],
        ['x'.repeat(101), 'a name longer than 100 characters'],
    ])('rejects %s as %s', async (name) => {
        const { app } = setup();

        const response = await app.request('/api/peers', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name }),
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'name must be between 1 and 100 characters',
        });
    });

    it('trims a peer name before creating it', async () => {
        const metadata = new InMemoryPeerMetadataStore();
        const { app } = setup(
            new InMemoryAwgDriver(),
            metadata,
        );

        const response = await app.request('/api/peers', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: '  New phone  ' }),
        });

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toMatchObject({
            name: 'New phone',
        });
        await expect(metadata.list()).resolves.toEqual([
            expect.objectContaining({ name: 'New phone' }),
        ]);
    });

    it('returns 400 for malformed JSON in POST', async () => {
        const { app } = setup();

        const response = await app.request('/api/peers', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{"name":',
        });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'invalid JSON',
        });
    });

    it('returns 400 for malformed JSON in PATCH', async () => {
        const { app } = setup();

        const response = await app.request(
            '/api/peers/11111111-1111-4111-8111-111111111111',
            {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: '{"name":',
            },
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'invalid JSON',
        });
    });
});
