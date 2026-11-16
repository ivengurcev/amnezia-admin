import {
    cleanup,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import PeerRow from './PeerRow';
import type { Peer } from './api';

const peer: Peer = {
    id: '11111111-1111-4111-8111-111111111111',
    publicKey: 'test-public-key',
    name: 'Телефон',
    address: '10.90.0.2',
    connected: true,
    latestHandshakeAt: '2026-09-22T10:00:00.000Z',
    rxBytes: 1024,
    txBytes: 2048,
};

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('PeerRow', () => {
    it('provides accessible labels for peer metrics', () => {
        render(<PeerRow peer={peer} onChanged={vi.fn()} />);

        expect(screen.getByText('Адрес:')).toHaveClass(
            'visually-hidden',
        );
        expect(screen.getByText('Статус:')).toHaveClass(
            'visually-hidden',
        );
        expect(screen.getByText('Handshake:')).toHaveClass(
            'visually-hidden',
        );
        expect(screen.getByText('RX:')).toHaveClass('visually-hidden');
        expect(screen.getByText('TX:')).toHaveClass('visually-hidden');
    });

    it('renames a peer inline using its API UUID', async () => {
        const user = userEvent.setup();
        const onChanged = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(null, { status: 204 }),
        );
        vi.stubGlobal('fetch', fetchMock);
        render(<PeerRow peer={peer} onChanged={onChanged} />);

        await user.click(screen.getByRole('button', {
            name: 'Переименовать',
        }));
        const input = screen.getByLabelText('Новое имя');
        await user.clear(input);
        await user.type(input, '  Ноутбук  ');
        await user.click(screen.getByRole('button', {
            name: 'Сохранить',
        }));

        expect(fetchMock).toHaveBeenCalledWith(
            `/api/peers/${peer.id}`,
            {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'Ноутбук' }),
            },
        );
        await waitFor(() => {
            expect(onChanged).toHaveBeenCalledOnce();
        });
    });

    it('deletes only after confirmation', async () => {
        const user = userEvent.setup();
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(null, { status: 204 }),
        );
        vi.stubGlobal('fetch', fetchMock);
        const onChanged = vi.fn().mockResolvedValue(undefined);
        render(<PeerRow peer={peer} onChanged={onChanged} />);

        await user.click(screen.getByRole('button', {
            name: 'Удалить',
        }));

        expect(window.confirm).toHaveBeenCalledWith(
            'Удалить peer «Телефон»?',
        );
        expect(fetchMock).toHaveBeenCalledWith(
            `/api/peers/${peer.id}`,
            { method: 'DELETE' },
        );
        await waitFor(() => {
            expect(onChanged).toHaveBeenCalledOnce();
        });
    });

    it('does not delete when confirmation is cancelled', async () => {
        const user = userEvent.setup();
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        render(<PeerRow peer={peer} onChanged={vi.fn()} />);

        await user.click(screen.getByRole('button', {
            name: 'Удалить',
        }));

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('disables mutations when the peer has no API UUID', () => {
        render(
            <PeerRow
                peer={{ ...peer, id: null }}
                onChanged={vi.fn()}
            />,
        );

        expect(screen.getByRole('button', {
            name: 'Переименовать',
        })).toBeDisabled();
        expect(screen.getByRole('button', {
            name: 'Удалить',
        })).toBeDisabled();
        expect(screen.getByTitle(
            'Действия недоступны: у peer нет API UUID',
        )).toBeInTheDocument();
    });

    it.each(['', '   ', 'x'.repeat(101)])(
        'rejects invalid rename %j without a request',
        async (name) => {
            const user = userEvent.setup();
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);
            render(<PeerRow peer={peer} onChanged={vi.fn()} />);

            await user.click(screen.getByRole('button', {
                name: 'Переименовать',
            }));
            await user.clear(screen.getByLabelText('Новое имя'));
            if (name) {
                await user.type(
                    screen.getByLabelText('Новое имя'),
                    name,
                );
            }
            await user.click(screen.getByRole('button', {
                name: 'Сохранить',
            }));

            expect(screen.getByRole('alert')).toHaveTextContent(
                'Имя должно содержать от 1 до 100 символов',
            );
            expect(fetchMock).not.toHaveBeenCalled();
        },
    );

    it('shows a mutation API error inside the row', async () => {
        const user = userEvent.setup();
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response(JSON.stringify({
                error: 'Peer not found',
            }), { status: 404 }),
        ));
        render(<PeerRow peer={peer} onChanged={vi.fn()} />);

        await user.click(screen.getByRole('button', {
            name: 'Удалить',
        }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Peer not found',
        );
        expect(screen.getByRole('button', {
            name: 'Удалить',
        })).toBeEnabled();
    });
});
