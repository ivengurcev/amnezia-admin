export type PeerStatus = {
    id: string;
    name: string;
    address: string;
    connected: boolean;
    latestHandshakeAt: string | null;
    rxBytes: number;
    txBytes: number;
};

export interface AwgDriver {
    listPeers(): Promise<PeerStatus[]>;
}
