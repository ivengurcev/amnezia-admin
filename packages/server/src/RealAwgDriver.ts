import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

import type {
    AwgDriver,
    CreatedPeer,
    CreatePeerOptions,
    EnsurePeerOptions,
    PeerStatus,
} from './awg.js';

const execFileAsync = promisify(execFile);

const CONNECTED_THRESHOLD_SECONDS = 180;

async function execWithInput(
    command: string,
    args: string[],
    input: string,
): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args);

        let stdout = '';
        let stderr = '';

        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');

        child.stdout.on('data', (data) => {
            stdout += data;
        });

        child.stderr.on('data', (data) => {
            stderr += data;
        });

        child.on('error', reject);

        child.on('close', (code) => {
            if (code !== 0) {
                reject(
                    new Error(
                        `${command} exited with code ${code}: ${stderr.trim()}`,
                    ),
                );
                return;
            }

            resolve(stdout);
        });

        child.stdin.end(input);
    });
}

export class RealAwgDriver implements AwgDriver {
    constructor(
        private readonly binary = 'awg',
        private readonly interfaceName = 'wg0',
    ) {}

    async getRawStatus(): Promise<string> {
        const { stdout } = await execFileAsync(
            this.binary,
            ['show', this.interfaceName],
            {
                encoding: 'utf8',
            },
        );

        return stdout;
    }

    async listPeers(): Promise<PeerStatus[]> {
        const { stdout } = await execFileAsync(
            this.binary,
            ['show', this.interfaceName, 'dump'],
            {
                encoding: 'utf8',
            },
        );

        const lines = stdout
            .trim()
            .split('\n')
            .filter(Boolean);

        const peerLines = lines.slice(1);

        return peerLines.map((line): PeerStatus => {
            const [
                publicKey,
                _presharedKey,
                _endpoint,
                allowedIps,
                latestHandshakeRaw,
                rxBytesRaw,
                txBytesRaw,
            ] = line.split('\t');

            const latestHandshake = Number(latestHandshakeRaw);
            const now = Math.floor(Date.now() / 1000);

            const connected =
                latestHandshake > 0 &&
                now - latestHandshake <= CONNECTED_THRESHOLD_SECONDS;

            const address =
                allowedIps
                    ?.split(',')[0]
                    ?.split('/')[0] ?? '';

            return {
                id: null,
                publicKey,
                name: address,
                address,
                connected,
                latestHandshakeAt:
                    latestHandshake > 0
                        ? new Date(latestHandshake * 1000).toISOString()
                        : null,
                rxBytes: Number(rxBytesRaw) || 0,
                txBytes: Number(txBytesRaw) || 0,
            };
        });
    }

    async createPeer(
        options: CreatePeerOptions,
    ): Promise<CreatedPeer> {
        const { stdout: privateKeyRaw } = await execFileAsync(
            this.binary,
            ['genkey'],
            {
                encoding: 'utf8',
            },
        );

        const privateKey = privateKeyRaw.trim();

        const publicKey = (
            await execWithInput(
                this.binary,
                ['pubkey'],
                `${privateKey}\n`,
            )
        ).trim();

        await execFileAsync(
            this.binary,
            [
                'set',
                this.interfaceName,
                'peer',
                publicKey,
                'allowed-ips',
                `${options.address}/32`,
            ],
            {
                encoding: 'utf8',
            },
        );
        const { stdout: serverPublicKeyRaw } = await execFileAsync(
            this.binary,
            [
                'show',
                this.interfaceName,
                'public-key',
            ],
            {
                encoding: 'utf8',
            },
        );

        const serverPublicKey = serverPublicKeyRaw.trim();

        const endpointHost =
            process.env.AWG_ENDPOINT_HOST ?? 'localhost';

        const endpointPort =
            process.env.AWG_PORT ?? '18443';

        const allowedIps =
            process.env.AWG_CLIENT_ALLOWED_IPS ?? '0.0.0.0/0';

        const persistentKeepalive =
            process.env.AWG_PERSISTENT_KEEPALIVE ?? '25';
        const headerProtectionKeyFile =
            process.env.AWG_HEADER_PROTECTION_KEY_FILE
            ?? '/data/header-protection.key';

        const headerProtectionKey = (
            await readFile(headerProtectionKeyFile, 'utf8')
        ).trim();
        const config = `[Interface]
PrivateKey = ${privateKey}
Address = ${options.address}/24
Jc = 4
Jmin = 10
Jmax = 50
S1 = 12
S2 = 12
S3 = 12
S4 = 12
H1 = 1
H2 = 2
H3 = 3
H4 = 4
HeaderProtectionKey = ${headerProtectionKey}
RekeyAfterTime = 100-120
RekeyTimeout = 3-7
RejectAfterTime = 150-180
KeepaliveTimeout = 5-15
MaxHandshakeAttempts = 15-20
RandomTrailers = on
DisableCookies = on

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${endpointHost}:${endpointPort}
AllowedIPs = ${allowedIps}
PersistentKeepalive = ${persistentKeepalive}
`;
        return {
            id: publicKey,
            name: options.name,
            address: options.address,
            publicKey,
            privateKey,
            config,
        };
    }

    async ensurePeer(options: EnsurePeerOptions): Promise<void> {
        await execFileAsync(
            this.binary,
            [
                'set',
                this.interfaceName,
                'peer',
                options.publicKey,
                'allowed-ips',
                `${options.address}/32`,
            ],
            {
                encoding: 'utf8',
            },
        );
    }

    async removePeer(publicKey: string): Promise<void> {
        await execFileAsync(
            this.binary,
            [
                'set',
                this.interfaceName,
                'peer',
                publicKey,
                'remove',
            ],
            {
                encoding: 'utf8',
            },
        );
    }
}
