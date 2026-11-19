import { useState } from 'react';
import Button from './ui/Button';
import Input from './ui/Input';
import layout from './Layout.module.css';

type Props = { url: string; onClose: () => void };
export default function LinkResult({ url, onClose }: Props) {
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState(false);
    async function copy() {
        setCopied(false); setError(false);
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
        } catch {
            setError(true);
        }
    }
    return <>
        <p className={layout.hint}>Ссылка одноразовая и действует 24 часа. Передайте её владельцу подключения.</p>
        <Input label="Одноразовая ссылка" value={url} readOnly onFocus={event => event.currentTarget.select()} />
        {copied && <p role="status">Ссылка скопирована</p>}
        {error && <p className={layout.errorText} role="alert">Не удалось скопировать. Скопируйте ссылку вручную из поля выше.</p>}
        <div className={layout.actions}>
            <Button variant="primary" onClick={() => void copy()}>Копировать ссылку</Button>
            <Button onClick={onClose}>Закрыть</Button>
        </div>
    </>;
}
