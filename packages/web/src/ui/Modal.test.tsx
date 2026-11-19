import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import Modal from './Modal';
afterEach(cleanup);
it('focuses content, wraps Tab, cancels and restores the opener', async () => {
    const user = userEvent.setup();
    const opener = document.createElement('button'); document.body.append(opener); opener.focus();
    const onClose = vi.fn();
    const { unmount } = render(<Modal title="Тест" onClose={onClose}><input aria-label="Поле" /><button>Готово</button></Modal>);
    expect(screen.getByRole('dialog', { name: 'Тест' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Поле')).toHaveFocus();
    await user.tab({ shift: true }); expect(screen.getByRole('button', { name: 'Готово' })).toHaveFocus();
    await user.tab(); expect(screen.getByLabelText('Поле')).toHaveFocus();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
    unmount(); expect(opener).toHaveFocus(); opener.remove();
});
it('prevents cancellation while busy', () => {
    const onClose = vi.fn();
    render(<Modal title="Тест" busy onClose={onClose}><button disabled>Ожидание</button></Modal>);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
});
