import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { createPeer, createPeerLink } from './api';
import LinkResult from './LinkResult';
import Button from './ui/Button';
import Input from './ui/Input';
import Modal from './ui/Modal';
import layout from './Layout.module.css';

type Props = { onCreated: () => void; onClose: () => void };

export default function CreatePeerForm({ onCreated, onClose }: Props) {
    const [name, setName] = useState('');
    const [publicKey, setPublicKey] = useState<string | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const errorId = useId();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting || publicKey) return;
        const normalizedName = name.trim();
        if (normalizedName.length > 100) {
            setError('Имя должно содержать не более 100 символов');
            return;
        }
        setSubmitting(true); setError(null);
        try {
            const created = await createPeer(normalizedName);
            setPublicKey(created.publicKey);
            onCreated();
            const link = await createPeerLink(created.publicKey);
            setUrl(link.url);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось выполнить запрос');
        } finally {
            setSubmitting(false);
        }
    }

    async function retryLink() {
        if (!publicKey || submitting) return;
        setSubmitting(true); setError(null);
        try {
            setUrl((await createPeerLink(publicKey)).url);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось получить ссылку');
        } finally { setSubmitting(false); }
    }

    return <Modal title="Добавить подключение" busy={submitting} onClose={onClose}>
        {url ? <LinkResult url={url} onClose={onClose} /> : publicKey ? <>
            <p>Подключение создано.</p>
            {error && <p className={layout.errorText} role="alert">{error}</p>}
            {submitting && <p role="status">Получение ссылки…</p>}
            <div className={layout.actions}>
                {error && <Button variant="primary" disabled={submitting} onClick={() => void retryLink()}>Повторить получение ссылки</Button>}
                <Button disabled={submitting} onClick={onClose}>Закрыть</Button>
            </div>
        </> : <form className={layout.form} onSubmit={handleSubmit}>
            <Input label="Имя подключения" name="name" value={name} disabled={submitting}
                aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
                onChange={event => { setName(event.target.value); setError(null); }} />
            {error && <p id={errorId} className={layout.errorText} role="alert">{error}</p>}
            <div className={layout.actions}>
                <Button variant="primary" type="submit" disabled={submitting}>{submitting ? 'Создание…' : 'Создать'}</Button>
                <Button disabled={submitting} onClick={onClose}>Отмена</Button>
            </div>
        </form>}
    </Modal>;
}
