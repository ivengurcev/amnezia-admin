import { describe, expect, it } from 'vitest';

import {
    PeerNotFoundError,
    PeerService,
} from '../src/PeerService.js';
import {
    InMemoryAwgDriver,
    InMemoryPeerMetadataStore,
    peerMetadata,
    peerStatus,
} from './fakes.js';

describe('PeerService', () => {
    it('lists AWG peers enriched with saved metadata', async () => {
        const awg = new InMemoryAwgDriver([
            peerStatus(),
        ]);
        const metadata = new InMemoryPeerMetadataStore([
            peerMetadata(),
        ]);
        const service = new PeerService(awg, metadata);

        await expect(service.listPeers()).resolves.toEqual([
            peerStatus({
                id: '11111111-1111-4111-8111-111111111111',
                name: 'Saved peer',
            }),
        ]);
    });

    it('creates a peer with the requested name', async () => {
        const service = new PeerService(
            new InMemoryAwgDriver(),
            new InMemoryPeerMetadataStore(),
        );

        const peer = await service.createPeer({ name: 'New phone' });

        expect(peer).toMatchObject({
            name: 'New phone',
            publicKey: 'test-public-key-1',
            privateKey: 'test-private-key-1',
            config: 'test-config-1',
        });
    });

    it('assigns the first free peer address', async () => {
        const awg = new InMemoryAwgDriver([
            peerStatus({ address: '10.90.0.2' }),
            peerStatus({
                publicKey: 'test-existing-public-key-2',
                address: '10.90.0.4',
            }),
        ]);
        const service = new PeerService(
            awg,
            new InMemoryPeerMetadataStore(),
        );

        const peer = await service.createPeer({ name: 'New phone' });

        expect(peer.address).toBe('10.90.0.3');
    });

    it('saves metadata for a created peer', async () => {
        const metadata = new InMemoryPeerMetadataStore();
        const service = new PeerService(
            new InMemoryAwgDriver(),
            metadata,
        );

        const peer = await service.createPeer({ name: 'New phone' });

        await expect(metadata.getById(peer.id)).resolves.toMatchObject({
            id: peer.id,
            publicKey: 'test-public-key-1',
            name: 'New phone',
            address: '10.90.0.2',
        });
    });

    it('uses a UUID API id distinct from the public key', async () => {
        const service = new PeerService(
            new InMemoryAwgDriver(),
            new InMemoryPeerMetadataStore(),
        );

        const peer = await service.createPeer({ name: 'New phone' });

        expect(peer.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
        expect(peer.id).not.toBe(peer.publicKey);
    });

    it('renames a peer by API id', async () => {
        const metadata = new InMemoryPeerMetadataStore([
            peerMetadata(),
        ]);
        const service = new PeerService(
            new InMemoryAwgDriver(),
            metadata,
        );

        await service.renamePeer(
            '11111111-1111-4111-8111-111111111111',
            'Renamed phone',
        );

        await expect(
            metadata.getById(
                '11111111-1111-4111-8111-111111111111',
            ),
        ).resolves.toMatchObject({ name: 'Renamed phone' });
    });

    it('deletes a peer and its metadata by API id', async () => {
        const awg = new InMemoryAwgDriver([
            peerStatus(),
        ]);
        const metadata = new InMemoryPeerMetadataStore([
            peerMetadata(),
        ]);
        const service = new PeerService(awg, metadata);

        await service.removePeer(
            '11111111-1111-4111-8111-111111111111',
        );

        await expect(awg.listPeers()).resolves.toEqual([]);
        await expect(metadata.list()).resolves.toEqual([]);
    });

    it.each([
        ['rename', (service: PeerService) => {
            return service.renamePeer('missing-id', 'New name');
        }],
        ['delete', (service: PeerService) => {
            return service.removePeer('missing-id');
        }],
    ])(
        'throws PeerNotFoundError when trying to %s a missing peer',
        async (_operation, action) => {
            const service = new PeerService(
                new InMemoryAwgDriver(),
                new InMemoryPeerMetadataStore(),
            );

            await expect(action(service)).rejects.toEqual(
                new PeerNotFoundError('missing-id'),
            );
        },
    );

    it('restores every saved peer in AWG', async () => {
        const awg = new InMemoryAwgDriver();
        const metadata = new InMemoryPeerMetadataStore([
            peerMetadata(),
            peerMetadata({
                id: '22222222-2222-4222-8222-222222222222',
                publicKey: 'test-existing-public-key-2',
                name: 'Second peer',
                address: '10.90.0.7',
            }),
        ]);
        const service = new PeerService(awg, metadata);

        await service.restorePeers();

        await expect(awg.listPeers()).resolves.toEqual([
            peerStatus({
                publicKey: 'test-existing-public-key',
                name: '',
            }),
            peerStatus({
                publicKey: 'test-existing-public-key-2',
                name: '',
                address: '10.90.0.7',
            }),
        ]);
    });
});
