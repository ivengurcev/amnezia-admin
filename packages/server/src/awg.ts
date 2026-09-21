export type PeerStatus = {
    id: string;
    name: string;
    address: string;
    connected: boolean;
    latestHandshakeAt: string | null;
    rxBytes: number;
    txBytes: number;
};

export type CreatePeerOptions = {
    name: string;
    address: string;
};

export type CreatedPeer = {
    id: string;
    name: string;
    address: string;
    publicKey: string;
    privateKey: string;
};

export type EnsurePeerOptions = {
    publicKey: string;
    address: string;
};

export interface AwgDriver {
    getRawStatus(): Promise<string>;
    listPeers(): Promise<PeerStatus[]>;
    createPeer(options: CreatePeerOptions): Promise<CreatedPeer>;
    ensurePeer(options: EnsurePeerOptions): Promise<void>;
    removePeer(publicKey: string): Promise<void>;
}
