import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type {
    PeerMetadata,
    PeerMetadataStore,
} from './peerMetadata.js';

import { randomUUID } from 'node:crypto';

export class FilePeerMetadataStore implements PeerMetadataStore {
    constructor(
        private readonly filePath = '/data/peers.json',
    ) {}

    async getById(id: string): Promise<PeerMetadata | null> {
        const items = await this.readAll();

        return items.find((item) => item.id === id) ?? null;
    }

    async getByPublicKey(
        publicKey: string,
    ): Promise<PeerMetadata | null> {
        const items = await this.readAll();

        return (
            items.find((item) => item.publicKey === publicKey) ??
            null
        );
    }

    async list(): Promise<PeerMetadata[]> {
        return this.readAll();
    }

    async save(metadata: PeerMetadata): Promise<void> {
        const items = await this.readAll();

        const index = items.findIndex(
            (item) => item.id === metadata.id,
        );

        if (index === -1) {
            items.push(metadata);
        } else {
            items[index] = metadata;
        }

        await this.writeAll(items);
    }

    async removeById(id: string): Promise<void> {
        const items = await this.readAll();

        await this.writeAll(
            items.filter((item) => item.id !== id),
        );
    }

    private async readAll(): Promise<PeerMetadata[]> {
        try {
            const content = await readFile(this.filePath, 'utf8');

            const data: unknown = JSON.parse(content);

            if (!Array.isArray(data)) {
                throw new Error(
                    'Peer metadata file must contain an array',
                );
            }

            const items = data as PeerMetadata[];

            let changed = false;

            for (const item of items) {
                if (!item.id) {
                    item.id = randomUUID();
                    changed = true;
                }
            }

            if (changed) {
                await this.writeAll(items);
            }

            return items;
            
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

    private async writeAll(
        items: PeerMetadata[],
    ): Promise<void> {
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
