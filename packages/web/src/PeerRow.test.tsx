import type { ReactNode } from 'react';
import { act, cleanup, render as renderComponent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PeerRow from './PeerRow';
import { json, link, peer } from '../test/fixtures';
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function render(children: ReactNode) {
    return renderComponent(<ul>{children}</ul>);
}

describe('PeerRow', () => {
    it('shows C++ fields, admin flag, VPN IP and accessible SVG actions', () => {
        render(<PeerRow peer={peer} onChanged={vi.fn()} />);
        expect(screen.getByText('Телефон')).toBeInTheDocument();
        expect(screen.getByText('10.90.0.2')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Администратор' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Подключён' })).toBeInTheDocument();
        expect(screen.getByText('1 КБ')).toBeInTheDocument();
        expect(screen.getByText('2 КБ')).toBeInTheDocument();
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(2);
        for (const button of buttons) expect(button.querySelector('svg')).not.toBeNull();
        expect(screen.queryByRole('button', { name: 'Переименовать' })).toBeNull();
    });
    it('ages status without a server refresh', () => {
        vi.useFakeTimers(); vi.setSystemTime(1000 * 1000);
        render(<PeerRow peer={{ ...peer, latestHandshake: 821 }} onChanged={vi.fn()} />);
        expect(screen.getByRole('img', { name: 'Подключён' })).toBeInTheDocument();
        act(() => { vi.advanceTimersByTime(10000); });
        expect(screen.getByRole('img', { name: 'Не подключён' })).toBeInTheDocument();
    });
    it('opens a link modal and issues a new one-time link', async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn().mockResolvedValue(json({ url: link }, 201)); vi.stubGlobal('fetch', fetchMock);
        render(<PeerRow peer={peer} onChanged={vi.fn()} />);
        await user.click(screen.getByRole('button', { name: 'Создать одноразовую ссылку' }));
        expect(await screen.findByRole('textbox', { name: 'Одноразовая ссылка' })).toHaveValue(link);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith('/api/peers/links', expect.objectContaining({ body: JSON.stringify({ publicKey: peer.publicKey, ttlSeconds: 86400 }) }));
        await user.click(screen.getByRole('button', { name: 'Закрыть' }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('offers retry inside the modal after link failure', async () => {
        const user = userEvent.setup();
        vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(json({ url: link })));
        render(<PeerRow peer={peer} onChanged={vi.fn()} />);
        await user.click(screen.getByRole('button', { name: 'Создать одноразовую ссылку' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось связаться с сервером');
        await user.click(screen.getByRole('button', { name: 'Повторить получение ссылки' }));
        expect(await screen.findByRole('textbox', { name: 'Одноразовая ссылка' })).toHaveValue(link);
    });
    it('deletes by publicKey after confirmation and refreshes', async () => {
        const user = userEvent.setup(); vi.spyOn(window, 'confirm').mockReturnValue(true);
        const onChanged = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetchMock);
        render(<PeerRow peer={peer} onChanged={onChanged} />);
        await user.click(screen.getByRole('button', { name: 'Удалить подключение' }));
        expect(window.confirm).toHaveBeenCalledWith('Удалить подключение «Телефон»?');
        expect(fetchMock).toHaveBeenCalledWith('/api/peers', expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ publicKey: peer.publicKey }) }));
        expect(onChanged).toHaveBeenCalledOnce();
    });
    it('does not delete when confirmation is cancelled', async () => {
        const user = userEvent.setup(); vi.spyOn(window, 'confirm').mockReturnValue(false);
        const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
        render(<PeerRow peer={peer} onChanged={vi.fn()} />);
        await user.click(screen.getByRole('button', { name: 'Удалить подключение' }));
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it('shows deletion errors and re-enables the action', async () => {
        const user = userEvent.setup(); vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'Peer not found' }, 404)));
        render(<PeerRow peer={peer} onChanged={vi.fn()} />);
        await user.click(screen.getByRole('button', { name: 'Удалить подключение' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Peer not found');
        expect(screen.getByRole('button', { name: 'Удалить подключение' })).toBeEnabled();
    });
});
