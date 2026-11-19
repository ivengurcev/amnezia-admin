import type { Peer } from '../src/api';
export const peer: Peer = {
    publicKey: 'key+/=', name: 'Телефон', allowedIps: '10.90.0.2/32', isAdmin: true,
    endpoint: '1.2.3.4:1234', latestHandshake: Math.floor(Date.now() / 1000), rx: 1024, tx: 2048,
};
export const link = 'https://vpn.example/setup/0123456789';
export function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status });
}
