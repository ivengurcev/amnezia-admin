import type {
    AwgDriver,
    CreatedPeer,
    CreatePeerOptions,
    EnsurePeerOptions,
    PeerStatus,
} from '../src/awg.js';
import type {
    PeerMetadata,
    PeerMetadataStore,
} from '../src/peerMetadata.js';

export class InMemoryAwgDriver implements AwgDriver {
    private peers: PeerStatus[];
    private nextPeerNumber = 1;

    constructor(peers: PeerStatus[] = []) {
        this.peers = peers.map((peer) => ({ ...peer }));
    }

    async getRawStatus(): Promise<string> {
        return 'Test AWG server is running';
    }

    async listPeers(): Promise<PeerStatus[]> {
        return this.peers.map((peer) => ({ ...peer }));
    }

    async createPeer(
        options: CreatePeerOptions,
    ): Promise<CreatedPeer> {
        const peerNumber = this.nextPeerNumber++;
        const publicKey = `test-public-key-${peerNumber}`;

        this.peers.push({
            id: null,
            publicKey,
            name: options.name,
            address: options.address,
            connected: false,
            latestHandshakeAt: null,
            rxBytes: 0,
            txBytes: 0,
        });

        return {
            id: `driver-peer-${peerNumber}`,
            publicKey,
            privateKey: `test-private-key-${peerNumber}`,
            name: options.name,
            address: options.address,
            config: `test-config-${peerNumber}`,
        };
    }

    async ensurePeer(options: EnsurePeerOptions): Promise<void> {
        const existing = this.peers.find(
            (peer) => peer.publicKey === options.publicKey,
        );

        if (existing) {
            return;
        }

        this.peers.push({
            id: null,
            publicKey: options.publicKey,
            name: '',
            address: options.address,
            connected: false,
            latestHandshakeAt: null,
            rxBytes: 0,
            txBytes: 0,
        });
    }

    async removePeer(publicKey: string): Promise<void> {
        this.peers = this.peers.filter(
            (peer) => peer.publicKey !== publicKey,
        );
    }
}

export class InMemoryPeerMetadataStore
implements PeerMetadataStore {
    private items: PeerMetadata[];

    constructor(items: PeerMetadata[] = []) {
        this.items = items.map((item) => ({ ...item }));
    }

    async getById(id: string): Promise<PeerMetadata | null> {
        const item = this.items.find((candidate) => {
            return candidate.id === id;
        });

        return item ? { ...item } : null;
    }

    async getByPublicKey(
        publicKey: string,
    ): Promise<PeerMetadata | null> {
        const item = this.items.find((candidate) => {
            return candidate.publicKey === publicKey;
        });

        return item ? { ...item } : null;
    }

    async list(): Promise<PeerMetadata[]> {
        return this.items.map((item) => ({ ...item }));
    }

    async save(metadata: PeerMetadata): Promise<void> {
        const index = this.items.findIndex((item) => {
            return item.id === metadata.id;
        });

        if (index === -1) {
            this.items.push({ ...metadata });
            return;
        }

        this.items[index] = { ...metadata };
    }

    async removeById(id: string): Promise<void> {
        this.items = this.items.filter((item) => item.id !== id);
    }
}

export function peerStatus(
    overrides: Partial<PeerStatus> = {},
): PeerStatus {
    return {
        id: null,
        publicKey: 'test-existing-public-key',
        name: 'AWG peer',
        address: '10.90.0.2',
        connected: false,
        latestHandshakeAt: null,
        rxBytes: 0,
        txBytes: 0,
        ...overrides,
    };
}

export function peerMetadata(
    overrides: Partial<PeerMetadata> = {},
): PeerMetadata {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        publicKey: 'test-existing-public-key',
        name: 'Saved peer',
        address: '10.90.0.2',
        createdAt: '2026-01-02T03:04:05.000Z',
        ...overrides,
    };
}
