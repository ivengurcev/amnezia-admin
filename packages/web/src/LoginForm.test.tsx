import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LoginForm from './LoginForm';
import { json } from '../test/fixtures';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('authentication mode', () => {
    it('hides inputs and submit while mode is loading', async () => {
        let resolve!: (response: Response) => void;
        const fetchMock = vi.fn().mockReturnValue(new Promise<Response>(r => { resolve = r; }));
        vi.stubGlobal('fetch', fetchMock);
        render(<LoginForm onLogin={vi.fn()} />);
        expect(screen.getByRole('status')).toHaveTextContent('Загрузка режима входа…');
        expect(screen.queryByLabelText('Публичный ключ')).toBeNull();
        expect(screen.queryByLabelText('Пароль')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Войти' })).toBeNull();
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/mode', undefined);
        resolve(json({ publicKeyRequired: true }));
        expect(await screen.findByLabelText('Публичный ключ')).toBeRequired();
    });

    it('requires key and password in development and submits both', async () => {
        const user = userEvent.setup();
        const onLogin = vi.fn();
        const fetchMock = vi.fn().mockResolvedValueOnce(json({ publicKeyRequired: true }))
            .mockResolvedValueOnce(json({ name: 'Admin' }));
        vi.stubGlobal('fetch', fetchMock);
        render(<LoginForm onLogin={onLogin} />);
        const key = await screen.findByLabelText('Публичный ключ');
        expect(key).toBeRequired();
        expect(screen.getByLabelText('Пароль')).toBeRequired();
        await user.type(key, '  dev-key  ');
        await user.type(screen.getByLabelText('Пароль'), 'secret');
        await user.click(screen.getByRole('button', { name: 'Войти' }));
        expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/login', expect.objectContaining({
            body: JSON.stringify({ publicKey: 'dev-key', password: 'secret' }),
        }));
        expect(onLogin).toHaveBeenCalledOnce();
    });

    it('shows only password in production and omits publicKey from login JSON', async () => {
        const user = userEvent.setup();
        const onLogin = vi.fn();
        const fetchMock = vi.fn().mockResolvedValueOnce(json({ publicKeyRequired: false }))
            .mockResolvedValueOnce(json({ name: 'Admin' }));
        vi.stubGlobal('fetch', fetchMock);
        render(<LoginForm onLogin={onLogin} />);
        const password = await screen.findByLabelText('Пароль');
        expect(screen.queryByLabelText('Публичный ключ')).toBeNull();
        await user.type(password, 'secret');
        await user.click(screen.getByRole('button', { name: 'Войти' }));
        expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/login', expect.objectContaining({
            body: JSON.stringify({ password: 'secret' }),
        }));
        expect(onLogin).toHaveBeenCalledOnce();
    });

    it('shows mode errors without a default form and retries the mode request', async () => {
        const user = userEvent.setup();
        let resolveRetry!: (response: Response) => void;
        const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('offline'))
            .mockReturnValueOnce(new Promise<Response>(r => { resolveRetry = r; }));
        vi.stubGlobal('fetch', fetchMock);
        render(<LoginForm onLogin={vi.fn()} />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось связаться с сервером');
        expect(screen.queryByLabelText('Пароль')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Войти' })).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Повторить' }));
        expect(screen.getByRole('status')).toHaveTextContent('Загрузка режима входа…');
        expect(screen.queryByRole('alert')).toBeNull();
        expect(screen.queryByLabelText('Пароль')).toBeNull();
        resolveRetry(json({ publicKeyRequired: false }));
        expect(await screen.findByLabelText('Пароль')).toBeInTheDocument();
        expect(screen.queryByLabelText('Публичный ключ')).toBeNull();
        expect(fetchMock.mock.calls.map(call => call[0])).toEqual(['/api/auth/mode', '/api/auth/mode']);
    });

    it('treats an invalid mode response as an error instead of production mode', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({})));
        render(<LoginForm onLogin={vi.fn()} />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Сервер вернул некорректный режим авторизации');
        expect(screen.queryByLabelText('Пароль')).toBeNull();
        expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
    });
});
