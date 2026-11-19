import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, checkCredentials, createPeer, createPeerLink, deletePeer, getSession, listPeers, logout } from './api';

const peer = {
    publicKey: 'key+/=', name: 'Телефон', allowedIps: '10.90.0.2/32',
    isAdmin: true, endpoint: null, latestHandshake: 1790000000, rx: 1024, tx: 2048,
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => vi.unstubAllGlobals());

describe('C++ API', () => {
    it('loads the C++ peer contract unchanged', async () => {
        const fetchMock = vi.fn().mockResolvedValue(json([peer]));
        vi.stubGlobal('fetch', fetchMock);
        await expect(listPeers()).resolves.toEqual([peer]);
        expect(fetchMock).toHaveBeenCalledWith('/api/peers', undefined);
    });
    it('sends a normalized name contract and uses publicKey from creation', async () => {
        const fetchMock = vi.fn().mockResolvedValue(json({ publicKey: peer.publicKey, allowedIps: peer.allowedIps }, 201));
        vi.stubGlobal('fetch', fetchMock);
        await expect(createPeer('Телефон')).resolves.toMatchObject({ publicKey: peer.publicKey });
        expect(fetchMock).toHaveBeenCalledWith('/api/peers', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Телефон' }),
        });
    });
    it('deletes with publicKey in a JSON body, never in a URL path', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
        vi.stubGlobal('fetch', fetchMock);
        await deletePeer(peer.publicKey);
        expect(fetchMock).toHaveBeenCalledWith('/api/peers', {
            method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ publicKey: peer.publicKey }),
        });
    });
    it('issues one-time links with the fixed 24-hour TTL', async () => {
        const fetchMock = vi.fn().mockResolvedValue(json({ url: 'https://vpn.example/setup/token' }, 201));
        vi.stubGlobal('fetch', fetchMock);
        await expect(createPeerLink(peer.publicKey)).resolves.toEqual({ url: 'https://vpn.example/setup/token' });
        expect(fetchMock).toHaveBeenCalledWith('/api/peers/links', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ publicKey: peer.publicKey, ttlSeconds: 86400 }),
        });
    });
    it('preserves cookie-session auth endpoints and request bodies', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(json({ name: 'Admin' }))
            .mockResolvedValueOnce(json({ name: 'Admin', publicKey: peer.publicKey }))
            .mockResolvedValueOnce(new Response(null, { status: 204 }));
        vi.stubGlobal('fetch', fetchMock);
        await checkCredentials(peer.publicKey, 'secret');
        await getSession();
        await logout();
        expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/auth/login', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ publicKey: peer.publicKey, password: 'secret' }),
        });
        expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/me', undefined);
        expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/auth/logout', { method: 'POST' });
    });
    it('keeps HTTP status and the server error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'Требуется авторизация' }, 401)));
        await expect(listPeers()).rejects.toEqual(new ApiError('Требуется авторизация', 401));
    });
    it('handles non-JSON server errors', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('gateway', { status: 502 })));
        await expect(listPeers()).rejects.toThrow('Ошибка сервера (HTTP 502)');
    });
    it('handles network errors', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
        await expect(listPeers()).rejects.toThrow('Не удалось связаться с сервером');
    });
    it('handles invalid successful JSON', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('invalid')));
        await expect(listPeers()).rejects.toThrow('Сервер вернул некорректный ответ');
    });
});
