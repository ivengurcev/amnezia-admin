import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { json, peer } from '../test/fixtures';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('App', () => {
    it('loads and shows connections from C++', async () => {
        let resolve!: (response: Response) => void;
        vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>(r => { resolve = r; })));
        render(<App />);
        expect(screen.getByText('Загрузка подключений…')).toBeInTheDocument();
        resolve(json([peer]));
        expect(await screen.findByText('Телефон')).toBeInTheDocument();
        expect(screen.getByRole('list', { name: 'Подключения' })).toBeInTheDocument();
        expect(screen.queryByRole('table')).toBeNull();
    });
    it('shows an empty state and opens the create modal on demand', async () => {
        const user = userEvent.setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([])));
        render(<App />);
        expect(await screen.findByText('Подключений пока нет')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Добавить подключение' }));
        expect(screen.getByRole('dialog', { name: 'Добавить подключение' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Отмена' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByRole('button', { name: 'Добавить подключение' })).toHaveFocus();
    });
    it('retries an initial load error', async () => {
        const user = userEvent.setup(); vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(json([])));
        render(<App />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось связаться с сервером');
        await user.click(screen.getByRole('button', { name: 'Повторить' }));
        expect(await screen.findByText('Подключений пока нет')).toBeInTheDocument();
    });
    it('retains current peers on failed refresh', async () => {
        const user = userEvent.setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json([peer])).mockRejectedValueOnce(new Error('offline')));
        render(<App />); await screen.findByText('Телефон');
        await user.click(screen.getByRole('button', { name: 'Обновить' }));
        await screen.findByRole('alert');
        expect(screen.getByText('Телефон')).toBeInTheDocument();
    });
    it('keeps the list during refresh and ignores stale replies after deleting', async () => {
        const user = userEvent.setup(); let resolve!: (response: Response) => void;
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json([peer]))
            .mockReturnValueOnce(new Promise<Response>(r => { resolve = r; }))
            .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json([])));
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        render(<App />); await screen.findByText('Телефон');
        await user.click(screen.getByRole('button', { name: 'Обновить' }));
        expect(screen.getByText('Телефон')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Обновление…' })).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'Удалить подключение' }));
        await screen.findByText('Подключений пока нет');
        await act(async () => { resolve(json([peer])); });
        expect(screen.queryByText('Телефон')).toBeNull();
    });
});
