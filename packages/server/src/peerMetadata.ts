export type PeerMetadata = {
    publicKey: string;
    name: string;
    address: string;
    createdAt: string;
};

export interface PeerMetadataStore {
    get(publicKey: string): Promise<PeerMetadata | null>;
    list(): Promise<PeerMetadata[]>;
    save(metadata: PeerMetadata): Promise<void>;
    remove(publicKey: string): Promise<void>;
}
