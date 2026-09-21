import type {
    AwgDriver,
    CreatedPeer,
    PeerStatus,
} from './awg.js';

import { getNextFreeAddress } from './ip.js';

import type {
    PeerMetadataStore,
} from './peerMetadata.js';

type CreatePeerOptions = {
    name: string;
};

export class PeerService {
    constructor(
        private readonly awg: AwgDriver,
        private readonly metadata: PeerMetadataStore,
    ) {}

    async listPeers(): Promise<PeerStatus[]> {
        const peers = await this.awg.listPeers();
        const metadata = await this.metadata.list();

        const metadataByKey = new Map(
            metadata.map((item) => [
                item.publicKey,
                item,
            ]),
        );

        return peers.map((peer) => {
            const item = metadataByKey.get(peer.id);

            if (!item) {
                return peer;
            }

            return {
                ...peer,
                name: item.name,
            };
        });
    }

    async createPeer(
        options: CreatePeerOptions,
    ): Promise<CreatedPeer> {
        const currentPeers = await this.awg.listPeers();

        const address = getNextFreeAddress(
            currentPeers.map((peer) => peer.address),
        );

        const peer = await this.awg.createPeer({
            name: options.name,
            address,
        });

        await this.metadata.save({
            publicKey: peer.publicKey,
            name: peer.name,
            address: peer.address,
            createdAt: new Date().toISOString(),
        });

        return peer;
    }
}
