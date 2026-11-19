import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import styles from './Modal.module.css';

type Props = { title: string; busy?: boolean; onClose: () => void; children: ReactNode };
const focusableSelector = 'button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]';

export default function Modal({ title, busy = false, onClose, children }: Props) {
    const dialog = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    useEffect(() => {
        const element = dialog.current!;
        const opener = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        element.showModal();
        (element.querySelector<HTMLElement>(focusableSelector) ?? element).focus();
        return () => {
            element.close();
            document.body.style.overflow = previousOverflow;
            if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        };
    }, []);

    function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
        if (event.key !== 'Tab') return;
        const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(focusableSelector));
        const first = elements[0];
        const last = elements.at(-1);
        if (!first) {
            event.preventDefault();
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
            event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
            event.preventDefault(); first.focus();
        }
    }

    return <dialog ref={dialog} className={styles.dialog} aria-modal="true" aria-labelledby={titleId}
        aria-busy={busy} tabIndex={-1} onKeyDown={handleKeyDown}
        onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
        onClick={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
        <div className={styles.content}>
            <h2 id={titleId}>{title}</h2>
            {children}
        </div>
    </dialog>;
}
