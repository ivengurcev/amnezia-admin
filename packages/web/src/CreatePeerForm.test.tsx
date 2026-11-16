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

import CreatePeerForm from './CreatePeerForm';

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('CreatePeerForm', () => {
    it('trims the name and downloads the config once', async () => {
        const user = userEvent.setup();
        const onCreated = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({
                id: '11111111-1111-4111-8111-111111111111',
                publicKey: 'test-public-key',
                privateKey: 'ephemeral-test-key',
                name: 'Рабочий / телефон',
                address: '10.90.0.2',
                config: '[Interface]\nPrivateKey = ephemeral-test-key',
            }), { status: 201 }),
        );
        vi.stubGlobal('fetch', fetchMock);
        const createObjectURL = vi.fn().mockReturnValue(
            'blob:test-config',
        );
        const revokeObjectURL = vi.fn();
        vi.stubGlobal('URL', {
            createObjectURL,
            revokeObjectURL,
        });
        let downloadedFilename = '';
        const click = vi.spyOn(
            HTMLAnchorElement.prototype,
            'click',
        ).mockImplementation(function captureDownloadName(
            this: HTMLAnchorElement,
        ) {
            downloadedFilename = this.download;
        });

        render(<CreatePeerForm onCreated={onCreated} />);

        await user.type(
            screen.getByLabelText('Имя peer'),
            '  Рабочий / телефон  ',
        );
        await user.click(screen.getByRole('button', {
            name: 'Создать peer',
        }));

        await waitFor(() => {
            expect(onCreated).toHaveBeenCalledOnce();
        });
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/peers',
            expect.objectContaining({
                body: JSON.stringify({
                    name: 'Рабочий / телефон',
                }),
            }),
        );
        expect(createObjectURL).toHaveBeenCalledWith(
            expect.any(Blob),
        );
        expect(click).toHaveBeenCalledOnce();
        expect(downloadedFilename).toBe('Рабочий-телефон.conf');
        expect(revokeObjectURL).toHaveBeenCalledWith(
            'blob:test-config',
        );
        expect(document.querySelector(
            'a[download="Рабочий-телефон.conf"]',
        )).toBeNull();
        expect(screen.getByLabelText('Имя peer')).toHaveValue('');
    });

    it.each(['', '   ', 'x'.repeat(101)])(
        'rejects invalid name %j without a request',
        async (name) => {
            const user = userEvent.setup();
            const fetchMock = vi.fn();
            vi.stubGlobal('fetch', fetchMock);
            render(<CreatePeerForm onCreated={vi.fn()} />);

            if (name) {
                await user.type(
                    screen.getByLabelText('Имя peer'),
                    name,
                );
            }

            await user.click(screen.getByRole('button', {
                name: 'Создать peer',
            }));

            expect(screen.getByRole('alert')).toHaveTextContent(
                'Имя должно содержать от 1 до 100 символов',
            );
            expect(fetchMock).not.toHaveBeenCalled();
        },
    );

    it('shows a create API error next to the form', async () => {
        const user = userEvent.setup();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response(JSON.stringify({
                error: 'Имя уже занято',
            }), { status: 400 }),
        ));
        render(<CreatePeerForm onCreated={vi.fn()} />);

        await user.type(
            screen.getByLabelText('Имя peer'),
            'Телефон',
        );
        await user.click(screen.getByRole('button', {
            name: 'Создать peer',
        }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Имя уже занято',
        );
    });
});
