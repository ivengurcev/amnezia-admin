import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Root from './Root';
import { json, peer } from '../test/fixtures';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('cookie session', () => {
    it('restores the session and logs out through the existing API', async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn().mockResolvedValueOnce(json({ name: 'Admin', publicKey: peer.publicKey }))
            .mockResolvedValueOnce(json([])).mockResolvedValueOnce(new Response(null, { status: 204 }));
        vi.stubGlobal('fetch', fetchMock);
        render(<Root />);
        await screen.findByText('Подключений пока нет');
        await user.click(screen.getByRole('button', { name: 'Выйти' }));
        expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument();
        expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/auth/logout', { method: 'POST' });
    });
    it('shows login after 401 and sends credentials before loading connections', async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 }))
            .mockResolvedValueOnce(json({ name: 'Admin' })).mockResolvedValueOnce(json([]));
        vi.stubGlobal('fetch', fetchMock);
        render(<Root />);
        await screen.findByRole('heading', { name: 'Вход' });
        await user.type(screen.getByLabelText('Публичный ключ'), '  key+/=  ');
        await user.type(screen.getByLabelText('Пароль'), 'secret');
        await user.click(screen.getByRole('button', { name: 'Войти' }));
        expect(await screen.findByText('Подключений пока нет')).toBeInTheDocument();
        expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/login', expect.objectContaining({ body: JSON.stringify({ publicKey: 'key+/=', password: 'secret' }) }));
        expect(screen.queryByLabelText('Пароль')).toBeNull();
    });
    it('retains the login form on invalid credentials', async () => {
        const user = userEvent.setup();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 }))
            .mockResolvedValueOnce(json({ error: 'Ошибка авторизации' }, 401)));
        render(<Root />);
        await screen.findByRole('heading', { name: 'Вход' });
        await user.type(screen.getByLabelText('Публичный ключ'), 'key');
        await user.type(screen.getByLabelText('Пароль'), 'wrong');
        await user.click(screen.getByRole('button', { name: 'Войти' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Ошибка авторизации');
        expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled();
    });
    it('shows a session-check failure instead of pretending the user is logged out', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
        render(<Root />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось связаться с сервером');
        expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Вход' })).toBeNull();
    });
    it('keeps the admin screen when logout fails', async () => {
        const user = userEvent.setup();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ name: 'Admin', publicKey: peer.publicKey }))
            .mockResolvedValueOnce(json([])).mockRejectedValueOnce(new Error('offline')));
        render(<Root />); await screen.findByText('Подключений пока нет');
        await user.click(screen.getByRole('button', { name: 'Выйти' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось связаться с сервером');
        expect(screen.getByRole('heading', { name: 'Подключения' })).toBeInTheDocument();
    });
});
