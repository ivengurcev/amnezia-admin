import { useEffect, useState } from 'react';
import { createPeerLink, deletePeer } from './api';
import type { Peer } from './api';
import { formatBytes, formatHandshake, formatVpnIp, isConnected } from './format';
import LinkResult from './LinkResult';
import Button from './ui/Button';
import IconButton from './ui/IconButton';
import Icon from './ui/Icon';
import Modal from './ui/Modal';
import layout from './Layout.module.css';
import styles from './PeerRow.module.css';

type Props = { peer: Peer; onChanged: () => Promise<void> };

export default function PeerRow({ peer, onChanged }: Props) {
    const displayName = peer.name.trim() || formatVpnIp(peer.allowedIps);
    const [operation, setOperation] = useState<'link' | 'delete' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkError, setLinkError] = useState<string | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    async function issueLink() {
        if (operation) return;
        setLinkOpen(true); setLinkError(null); setUrl(null); setOperation('link');
        try {
            setUrl((await createPeerLink(peer.publicKey)).url);
        } catch (err) {
            setLinkError(err instanceof Error ? err.message : 'Не удалось получить ссылку');
        } finally { setOperation(null); }
    }

    async function handleDelete() {
        if (operation || !window.confirm(`Удалить подключение «${displayName}»?`)) return;
        setOperation('delete'); setError(null);
        try {
            await deletePeer(peer.publicKey);
            await onChanged();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось удалить подключение');
        } finally { setOperation(null); }
    }

    const connected = isConnected(peer.latestHandshake, now);
    return <li className={styles.row}>
        <div className={styles.identity}>
            <span className={`${styles.status} ${connected ? styles.online : ''}`}>
                <Icon name={connected ? 'online' : 'offline'} label={connected ? 'Подключён' : 'Не подключён'} />
            </span>
            <div className={styles.name}>
                <strong title={displayName}>{displayName}</strong>
                <span className={peer.isAdmin ? styles.admin : styles.user}>
                    <Icon name={peer.isAdmin ? 'admin' : 'user'} label={peer.isAdmin ? 'Администратор' : 'Пользователь'} />
                </span>
            </div>
            <span className={styles.address}>{formatVpnIp(peer.allowedIps)}</span>
        </div>
        <div className={styles.metrics}>
            <span className={styles.metric}><Icon name="clock" label="Последний handshake" />{peer.latestHandshake > 0 ? formatHandshake(peer.latestHandshake) : <span title="Нет данных">—</span>}</span>
            <span className={styles.metric}><Icon name="download" label="RX" />{formatBytes(peer.rx)}</span>
            <span className={styles.metric}><Icon name="upload" label="TX" />{formatBytes(peer.tx)}</span>
        </div>
        <div className={styles.actions}>
            <IconButton compact icon="link" label="Создать одноразовую ссылку" disabled={operation !== null} onClick={() => void issueLink()} />
            <IconButton compact icon="delete" label="Удалить подключение" variant="danger" disabled={operation !== null} onClick={() => void handleDelete()} />
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {linkOpen && <Modal title="Одноразовая ссылка" busy={operation === 'link'} onClose={() => setLinkOpen(false)}>
            {url ? <LinkResult url={url} onClose={() => setLinkOpen(false)} /> : <>
                {operation === 'link' && <p role="status">Получение ссылки…</p>}
                {linkError && <p className={layout.errorText} role="alert">{linkError}</p>}
                <div className={layout.actions}>
                    {linkError && <Button variant="primary" onClick={() => void issueLink()}>Повторить получение ссылки</Button>}
                    <Button disabled={operation === 'link'} onClick={() => setLinkOpen(false)}>Закрыть</Button>
                </div>
            </>}
        </Modal>}
    </li>;
}
