export type Peer = {
    publicKey: string;
    name: string;
    allowedIps: string;
    isAdmin: boolean;
    endpoint: string | null;
    latestHandshake: number;
    rx: number;
    tx: number;
};

export type CreatedPeer = {
    publicKey: string;
    allowedIps: string;
};

export class ApiError extends Error {
    constructor(message: string, readonly status?: number) {
        super(message);
        this.name = 'ApiError';
    }
}

async function request<T>(
    path: string,
    options?: RequestInit,
): Promise<T> {
    let response: Response;

    try {
        response = await fetch(path, options);
    } catch {
        throw new ApiError('Не удалось связаться с сервером');
    }

    if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message = body &&
            typeof body === 'object' &&
            'error' in body &&
            typeof body.error === 'string'
            ? body.error
            : `Ошибка сервера (HTTP ${response.status})`;

        throw new ApiError(message, response.status);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    try {
        return await response.json() as T;
    } catch {
        throw new ApiError('Сервер вернул некорректный ответ');
    }
}

const jsonHeaders = { 'content-type': 'application/json' };

export function listPeers(): Promise<Peer[]> {
    return request<Peer[]>('/api/peers');
}

export function createPeer(name: string): Promise<CreatedPeer> {
    return request<CreatedPeer>('/api/peers', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ name }),
    });
}

export function deletePeer(publicKey: string): Promise<void> {
    return request<void>('/api/peers', {
        method: 'DELETE',
        headers: jsonHeaders,
        body: JSON.stringify({ publicKey }),
    });
}

export function createPeerLink(publicKey: string): Promise<{ url: string }> {
    return request<{ url: string }>('/api/peers/links', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ publicKey, ttlSeconds: 86400 }),
    });
}

export type AuthMode = {
    publicKeyRequired: boolean;
};

export async function getAuthMode(): Promise<AuthMode> {
    const mode = await request<unknown>('/api/auth/mode');

    if (
        !mode || typeof mode !== 'object' ||
        !('publicKeyRequired' in mode) ||
        typeof mode.publicKeyRequired !== 'boolean'
    ) {
        throw new ApiError('Сервер вернул некорректный режим авторизации');
    }

    return { publicKeyRequired: mode.publicKeyRequired };
}

export function checkCredentials(
    publicKey: string | undefined,
    password: string,
): Promise<{ name: string }> {
    return request<{ name: string }>('/api/auth/login', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ publicKey, password }),
    });
}

export type AdminSession = {
    name: string;
    publicKey: string;
};

export function getSession(): Promise<AdminSession> {
    return request<AdminSession>('/api/auth/me');
}

export function logout(): Promise<void> {
    return request<void>('/api/auth/logout', {
        method: 'POST',
    });
}