import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import LinkResult from './LinkResult';
import { link } from '../test/fixtures';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('copies the issued URL', async () => {
    const user = userEvent.setup(); const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<LinkResult url={link} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Копировать ссылку' }));
    expect(write).toHaveBeenCalledWith(link);
    expect(await screen.findByRole('status')).toHaveTextContent('Ссылка скопирована');
});
it('keeps the URL available when clipboard fails', async () => {
    const user = userEvent.setup(); vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    render(<LinkResult url={link} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Копировать ссылку' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Скопируйте ссылку вручную');
    expect(screen.getByLabelText('Одноразовая ссылка')).toHaveValue(link);
});
