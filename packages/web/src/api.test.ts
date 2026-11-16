import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    ApiError,
    createPeer,
    deletePeer,
    listPeers,
    renamePeer,
} from './api';

const peer = {
    id: '11111111-1111-4111-8111-111111111111',
    publicKey: 'test-public-key',
    name: 'Телефон',
    address: '10.90.0.2',
    connected: true,
    latestHandshakeAt: '2026-09-22T10:00:00.000Z',
    rxBytes: 1024,
    txBytes: 2048,
};

afterEach(() => vi.unstubAllGlobals());

describe('peer API', () => {
    it('loads peers from the relative API path', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify([peer]), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            }),
        );
        vi.stubGlobal('fetch', fetchMock);

        await expect(listPeers()).resolves.toEqual([peer]);
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/peers',
            undefined,
        );
    });

    it('sends create and rename names as JSON', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                id: peer.id,
                publicKey: peer.publicKey,
                name: peer.name,
                address: peer.address,
                privateKey: 'ephemeral-test-key',
                config: 'test-config',
            }), { status: 201 }))
            .mockResolvedValueOnce(
                new Response(null, { status: 204 }),
            );
        vi.stubGlobal('fetch', fetchMock);

        await createPeer('Телефон');
        await renamePeer(peer.id, 'Ноутбук');

        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            '/api/peers',
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'Телефон' }),
            },
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            `/api/peers/${peer.id}`,
            {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'Ноутбук' }),
            },
        );
    });

    it('sends delete without a request body', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(null, { status: 204 }),
        );
        vi.stubGlobal('fetch', fetchMock);

        await deletePeer(peer.id);

        expect(fetchMock).toHaveBeenCalledWith(
            `/api/peers/${peer.id}`,
            { method: 'DELETE' },
        );
    });

    it('uses an API error message when available', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ error: 'Peer not found' }), {
                status: 404,
            }),
        ));

        await expect(deletePeer(peer.id)).rejects.toEqual(
            new ApiError('Peer not found', 404),
        );
    });

    it('falls back to the HTTP status for a non-JSON error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response('gateway error', { status: 502 }),
        ));

        await expect(listPeers()).rejects.toThrow(
            'Ошибка сервера (HTTP 502)',
        );
    });

    it('turns network rejection into a readable error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
            new TypeError('network failed'),
        ));

        await expect(listPeers()).rejects.toThrow(
            'Не удалось связаться с сервером',
        );
    });
});
