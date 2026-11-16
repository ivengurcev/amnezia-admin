import {
    act,
    cleanup,
    render,
    screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import App from './App';
import type { Peer } from './api';

const connectedPeer: Peer = {
    id: '11111111-1111-4111-8111-111111111111',
    publicKey: 'test-public-key-1',
    name: 'Телефон',
    address: '10.90.0.2',
    connected: true,
    latestHandshakeAt: '2026-09-22T10:00:00.000Z',
    rxBytes: 1024,
    txBytes: 2048,
};

const disconnectedPeer: Peer = {
    id: '22222222-2222-4222-8222-222222222222',
    publicKey: 'test-public-key-2',
    name: 'Ноутбук',
    address: '10.90.0.3',
    connected: false,
    latestHandshakeAt: null,
    rxBytes: 0,
    txBytes: 0,
};

function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('App', () => {
    it('shows loading and then every peer field', async () => {
        let resolveRequest!: (response: Response) => void;
        vi.stubGlobal('fetch', vi.fn().mockReturnValue(
            new Promise<Response>((resolve) => {
                resolveRequest = resolve;
            }),
        ));

        render(<App />);

        expect(screen.getByText('Загрузка peers…'))
            .toBeInTheDocument();

        resolveRequest(jsonResponse([
            connectedPeer,
            disconnectedPeer,
        ]));

        expect(await screen.findByText('Телефон'))
            .toBeInTheDocument();
        expect(screen.getByText('10.90.0.2')).toBeInTheDocument();
        expect(screen.getByText('Подключён')).toBeInTheDocument();
        expect(screen.getByText('Не подключён')).toBeInTheDocument();
        expect(screen.getByText('Нет данных')).toBeInTheDocument();
        expect(screen.getByText('1 КБ')).toBeInTheDocument();
        expect(screen.getByText('2 КБ')).toBeInTheDocument();
        expect(screen.getAllByRole('button', {
            name: 'Переименовать',
        })).toHaveLength(2);
        expect(screen.getAllByRole('button', {
            name: 'Удалить',
        })).toHaveLength(2);
    });

    it('shows an empty state', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            jsonResponse([]),
        ));

        render(<App />);

        expect(await screen.findByText('Peers пока нет'))
            .toBeInTheDocument();
    });

    it('shows a load error and retries', async () => {
        const user = userEvent.setup();
        vi.stubGlobal('fetch', vi.fn()
            .mockRejectedValueOnce(new TypeError('offline'))
            .mockResolvedValueOnce(jsonResponse([])));

        render(<App />);

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Не удалось связаться с сервером',
        );

        await user.click(screen.getByRole('button', {
            name: 'Повторить',
        }));

        expect(await screen.findByText('Peers пока нет'))
            .toBeInTheDocument();
    });

    it('refreshes without hiding the current list', async () => {
        const user = userEvent.setup();
        let resolveRefresh!: (response: Response) => void;
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse([connectedPeer]))
            .mockReturnValueOnce(new Promise<Response>((resolve) => {
                resolveRefresh = resolve;
            }));
        vi.stubGlobal('fetch', fetchMock);

        render(<App />);

        expect(await screen.findByText('Телефон'))
            .toBeInTheDocument();
        await user.click(screen.getByRole('button', {
            name: 'Обновить',
        }));
        expect(screen.getByText('Телефон')).toBeInTheDocument();
        expect(screen.getByRole('button', {
            name: 'Обновление…',
        })).toBeDisabled();

        resolveRefresh(jsonResponse([disconnectedPeer]));

        expect(await screen.findByText('Ноутбук'))
            .toBeInTheDocument();
        expect(screen.queryByText('Телефон')).not.toBeInTheDocument();
    });

    it('keeps current peers when refresh fails', async () => {
        const user = userEvent.setup();
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce(jsonResponse([connectedPeer]))
            .mockRejectedValueOnce(new TypeError('offline')));

        render(<App />);

        expect(await screen.findByText('Телефон'))
            .toBeInTheDocument();
        await user.click(screen.getByRole('button', {
            name: 'Обновить',
        }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Не удалось связаться с сервером',
        );
        expect(screen.getByText('Телефон')).toBeInTheDocument();
    });

    it('refreshes the list after creating a peer', async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse([]))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                id: connectedPeer.id,
                publicKey: connectedPeer.publicKey,
                privateKey: 'ephemeral-test-key',
                name: connectedPeer.name,
                address: connectedPeer.address,
                config: 'test-config',
            }), { status: 201 }))
            .mockResolvedValueOnce(jsonResponse([connectedPeer]));
        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn().mockReturnValue('blob:test'),
            revokeObjectURL: vi.fn(),
        });
        vi.spyOn(HTMLAnchorElement.prototype, 'click')
            .mockImplementation(() => undefined);

        render(<App />);

        expect(await screen.findByText('Peers пока нет'))
            .toBeInTheDocument();
        await user.type(
            screen.getByLabelText('Имя peer'),
            'Телефон',
        );
        await user.click(screen.getByRole('button', {
            name: 'Создать peer',
        }));

        expect(await screen.findByText('Телефон'))
            .toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('ignores a stale refresh after a newer delete refresh', async () => {
        const user = userEvent.setup();
        let resolveStaleRefresh!: (response: Response) => void;
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse([connectedPeer]))
            .mockReturnValueOnce(new Promise<Response>((resolve) => {
                resolveStaleRefresh = resolve;
            }))
            .mockResolvedValueOnce(
                new Response(null, { status: 204 }),
            )
            .mockResolvedValueOnce(jsonResponse([]));
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        render(<App />);

        expect(await screen.findByText('Телефон'))
            .toBeInTheDocument();
        await user.click(screen.getByRole('button', {
            name: 'Обновить',
        }));
        await user.click(screen.getByRole('button', {
            name: 'Удалить',
        }));
        expect(await screen.findByText('Peers пока нет'))
            .toBeInTheDocument();

        await act(async () => {
            resolveStaleRefresh(jsonResponse([connectedPeer]));
        });

        expect(screen.queryByText('Телефон')).not.toBeInTheDocument();
        expect(screen.getByText('Peers пока нет')).toBeInTheDocument();
    });
});
