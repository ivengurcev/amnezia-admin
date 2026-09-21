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
        const jc = process.env.AWG_JC ?? '4';
        const jmin = process.env.AWG_JMIN ?? '10';
        const jmax = process.env.AWG_JMAX ?? '50';

        const s1 = process.env.AWG_S1 ?? '12';
        const s2 = process.env.AWG_S2 ?? '12';
        const s3 = process.env.AWG_S3 ?? '12';
        const s4 = process.env.AWG_S4 ?? '12';

        const h1 = process.env.AWG_H1 ?? '1';
        const h2 = process.env.AWG_H2 ?? '2';
        const h3 = process.env.AWG_H3 ?? '3';
        const h4 = process.env.AWG_H4 ?? '4';

        const rekeyAfterTime =
            process.env.AWG_REKEY_AFTER_TIME ?? '100-120';

        const rekeyTimeout =
            process.env.AWG_REKEY_TIMEOUT ?? '3-7';

        const rejectAfterTime =
            process.env.AWG_REJECT_AFTER_TIME ?? '150-180';

        const keepaliveTimeout =
            process.env.AWG_KEEPALIVE_TIMEOUT ?? '5-15';

        const maxHandshakeAttempts =
            process.env.AWG_MAX_HANDSHAKE_ATTEMPTS ?? '15-20';

        const randomTrailers =
            process.env.AWG_RANDOM_TRAILERS ?? 'on';

        const disableCookies =
            process.env.AWG_DISABLE_COOKIES ?? 'on';        
        const config = `[Interface]
PrivateKey = ${privateKey}
Address = ${options.address}/24
Jc = ${jc}
Jmin = ${jmin}
Jmax = ${jmax}
S1 = ${s1}
S2 = ${s2}
S3 = ${s3}
S4 = ${s4}
H1 = ${h1}
H2 = ${h2}
H3 = ${h3}
H4 = ${h4}
HeaderProtectionKey = ${headerProtectionKey}
RekeyAfterTime = ${rekeyAfterTime}
RekeyTimeout = ${rekeyTimeout}
RejectAfterTime = ${rejectAfterTime}
KeepaliveTimeout = ${keepaliveTimeout}
MaxHandshakeAttempts = ${maxHandshakeAttempts}
RandomTrailers = ${randomTrailers}
DisableCookies = ${disableCookies}

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
