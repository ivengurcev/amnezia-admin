export type PeerMetadata = {
    id: string;
    publicKey: string;
    name: string;
    address: string;
    createdAt: string;
};

export interface PeerMetadataStore {
    getById(id: string): Promise<PeerMetadata | null>;
    getByPublicKey(publicKey: string): Promise<PeerMetadata | null>;
    list(): Promise<PeerMetadata[]>;
    save(metadata: PeerMetadata): Promise<void>;
    removeById(id: string): Promise<void>;
}
