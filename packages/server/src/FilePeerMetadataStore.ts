import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type {
    PeerMetadata,
    PeerMetadataStore,
} from './peerMetadata.js';

export class FilePeerMetadataStore implements PeerMetadataStore {
    constructor(
        private readonly filePath = '/data/peers.json',
    ) {}

    async get(publicKey: string): Promise<PeerMetadata | null> {
        const items = await this.readAll();

        return items.find((item) => item.publicKey === publicKey) ?? null;
    }

    async list(): Promise<PeerMetadata[]> {
        return this.readAll();
    }

    async save(metadata: PeerMetadata): Promise<void> {
        const items = await this.readAll();

        const index = items.findIndex(
            (item) => item.publicKey === metadata.publicKey,
        );

        if (index === -1) {
            items.push(metadata);
        } else {
            items[index] = metadata;
        }

        await this.writeAll(items);
    }

    async remove(publicKey: string): Promise<void> {
        const items = await this.readAll();

        await this.writeAll(
            items.filter((item) => item.publicKey !== publicKey),
        );
    }

    private async readAll(): Promise<PeerMetadata[]> {
        try {
            const content = await readFile(this.filePath, 'utf8');

            const data: unknown = JSON.parse(content);

            if (!Array.isArray(data)) {
                throw new Error('Peer metadata file must contain an array');
            }

            return data as PeerMetadata[];
        } catch (error) {
            if (
                error instanceof Error &&
                'code' in error &&
                error.code === 'ENOENT'
            ) {
                return [];
            }

            throw error;
        }
    }

    private async writeAll(items: PeerMetadata[]): Promise<void> {
        await mkdir(dirname(this.filePath), {
            recursive: true,
        });

        await writeFile(
            this.filePath,
            JSON.stringify(items, null, 4),
            {
                encoding: 'utf8',
                mode: 0o600,
            },
        );
    }
}
