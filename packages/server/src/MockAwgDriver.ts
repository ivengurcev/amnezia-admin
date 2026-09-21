import type { AwgDriver, PeerStatus } from './awg.js';

export class MockAwgDriver implements AwgDriver {
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
}
