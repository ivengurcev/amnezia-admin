import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CreatePeerForm from './CreatePeerForm';
import { json, link, peer } from '../test/fixtures';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const createButton = () => screen.getByRole('button', { name: 'Создать' });

describe('create connection modal', () => {
    it('creates once, refreshes immediately and shows a link in the same modal', async () => {
        const user = userEvent.setup();
        const onCreated = vi.fn().mockResolvedValue(undefined);
        const onClose = vi.fn();
        const fetchMock = vi.fn().mockResolvedValueOnce(json({ publicKey: peer.publicKey, allowedIps: peer.allowedIps }, 201))
            .mockResolvedValueOnce(json({ url: link }, 201));
        vi.stubGlobal('fetch', fetchMock);
        render(<CreatePeerForm onCreated={onCreated} onClose={onClose} />);
        const dialog = screen.getByRole('dialog');
        await user.type(screen.getByLabelText('Имя подключения'), '  Телефон  ');
        await user.click(createButton());
        expect(await screen.findByLabelText('Одноразовая ссылка')).toHaveValue(link);
        expect(screen.getByRole('dialog')).toBe(dialog);
        expect(onCreated).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/peers', expect.objectContaining({ body: JSON.stringify({ name: 'Телефон' }) }));
        expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/peers/links', expect.objectContaining({ body: JSON.stringify({ publicKey: peer.publicKey, ttlSeconds: 86400 }) }));
        expect(document.querySelector('a[download]')).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Закрыть' }));
        expect(onClose).toHaveBeenCalledOnce();
    });
    it('does not delay link issuance while refreshing the list', async () => {
        const user = userEvent.setup();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ publicKey: peer.publicKey }, 201))
            .mockResolvedValueOnce(json({ url: link }, 201)));
        const onCreated = vi.fn().mockReturnValue(new Promise<void>(() => {}));
        render(<CreatePeerForm onCreated={onCreated} onClose={vi.fn()} />);
        await user.type(screen.getByLabelText('Имя подключения'), 'Телефон');
        await user.click(createButton());
        expect(await screen.findByLabelText('Одноразовая ссылка')).toHaveValue(link);
        expect(onCreated).toHaveBeenCalledOnce();
    });
    it('retries only link issuance after a successful creation', async () => {
        const user = userEvent.setup();
        const onCreated = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi.fn().mockResolvedValueOnce(json({ publicKey: peer.publicKey, allowedIps: peer.allowedIps }, 201))
            .mockRejectedValueOnce(new TypeError('offline'))
            .mockResolvedValueOnce(json({ url: link }, 201));
        vi.stubGlobal('fetch', fetchMock);
        render(<CreatePeerForm onCreated={onCreated} onClose={vi.fn()} />);
        await user.type(screen.getByLabelText('Имя подключения'), 'Телефон');
        await user.click(createButton());
        expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось связаться с сервером');
        expect(screen.queryByRole('button', { name: 'Создать' })).toBeNull();
        expect(onCreated).toHaveBeenCalledOnce();
        await user.click(screen.getByRole('button', { name: 'Повторить получение ссылки' }));
        expect(await screen.findByLabelText('Одноразовая ссылка')).toHaveValue(link);
        expect(fetchMock.mock.calls.map(call => call[0])).toEqual(['/api/peers', '/api/peers/links', '/api/peers/links']);
    });
    it.each(['', '   ', 'x'.repeat(101)])('rejects invalid name %j', async name => {
        const user = userEvent.setup();
        const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
        render(<CreatePeerForm onCreated={vi.fn()} onClose={vi.fn()} />);
        if (name) await user.type(screen.getByLabelText('Имя подключения'), name);
        await user.click(createButton());
        expect(screen.getByRole('alert')).toHaveTextContent('Имя должно содержать от 1 до 100 символов');
        expect(fetchMock).not.toHaveBeenCalled();
    });
    it('blocks duplicate submission and closing while creating', async () => {
        const user = userEvent.setup();
        let resolve!: (response: Response) => void;
        const fetchMock = vi.fn().mockReturnValueOnce(new Promise<Response>(r => { resolve = r; }))
            .mockResolvedValueOnce(json({ url: link }, 201));
        vi.stubGlobal('fetch', fetchMock);
        const onClose = vi.fn();
        render(<CreatePeerForm onCreated={vi.fn()} onClose={onClose} />);
        await user.type(screen.getByLabelText('Имя подключения'), 'Телефон');
        await user.click(createButton());
        expect(screen.getByRole('button', { name: 'Создание…' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Отмена' })).toBeDisabled();
        screen.getByRole('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
        expect(onClose).not.toHaveBeenCalled();
        resolve(json({ publicKey: peer.publicKey }, 201));
        await screen.findByLabelText('Одноразовая ссылка');
    });
    it('shows creation errors without requesting a link', async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn().mockResolvedValue(json({ error: 'Не удалось создать' }, 500));
        vi.stubGlobal('fetch', fetchMock);
        render(<CreatePeerForm onCreated={vi.fn()} onClose={vi.fn()} />);
        await user.type(screen.getByLabelText('Имя подключения'), 'Телефон');
        await user.click(createButton());
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Не удалось создать'));
        expect(fetchMock).toHaveBeenCalledOnce();
    });
});
