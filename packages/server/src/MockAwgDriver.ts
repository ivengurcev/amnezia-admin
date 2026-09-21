import { randomUUID } from 'node:crypto';

import type {
    AwgDriver,
    CreatedPeer,
    CreatePeerOptions,
    EnsurePeerOptions,
    PeerStatus,
} from './awg.js';

export class MockAwgDriver implements AwgDriver {
    async getRawStatus(): Promise<string> {
        return 'Mock AWG server is running';
    }

    async listPeers(): Promise<PeerStatus[]> {
        return [
            {
                id: 'peer-1',
                name: 'Ivan Phone',
                address: '10.90.0.2',
                connected: true,
                latestHandshakeAt: new Date().toISOString(),
                rxBytes: 1024 * 1024 * 12,
                txBytes: 1024 * 1024 * 48,
            },
            {
                id: 'peer-2',
                name: 'Laptop',
                address: '10.90.0.3',
                connected: false,
                latestHandshakeAt: null,
                rxBytes: 0,
                txBytes: 0,
            },
        ];
    }

    async createPeer(options: CreatePeerOptions): Promise<CreatedPeer> {
        return {
            id: randomUUID(),
            name: options.name,
            address: options.address,
            publicKey: `mock-public-${randomUUID()}`,
            privateKey: `mock-private-${randomUUID()}`,
        };
    }

    async ensurePeer(_options: EnsurePeerOptions): Promise<void> {}
}
