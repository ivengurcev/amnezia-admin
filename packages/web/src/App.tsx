import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import { listPeers } from './api';
import type { Peer } from './api';
import CreatePeerForm from './CreatePeerForm';
import PeerRow from './PeerRow';
import Shell from './Shell';
import Button from './ui/Button';
import IconButton from './ui/IconButton';
import layout from './Layout.module.css';
import rowStyles from './PeerRow.module.css';

function getErrorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : 'Не удалось выполнить запрос';
}
type AppProps = {
    onLogout?: () => void;
};

export default function App({ onLogout }: AppProps) {
    const [creating, setCreating] = useState(false);
    const [peers, setPeers] = useState<Peer[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const latestRequest = useRef(0);

    const loadPeers = useCallback(async (
        preserveExisting = false,
    ): Promise<void> => {
        const requestId = ++latestRequest.current;

        setLoadError(null);

        if (preserveExisting) {
            setRefreshing(true);
        } else {
            setPeers(null);
        }

        try {
            const nextPeers = await listPeers();

            if (requestId === latestRequest.current) {
                setPeers(nextPeers);
            }
        } catch (error) {
            if (requestId === latestRequest.current) {
                setLoadError(getErrorMessage(error));
            }
        } finally {
            if (requestId === latestRequest.current) {
                setRefreshing(false);
            }
        }
    }, []);

    useEffect(() => {
        void loadPeers();
    }, [loadPeers]);

    return <Shell onLogout={onLogout}>
        <section className={layout.panel} aria-labelledby="peers-heading">
            <div className={rowStyles.toolbar}>
                <h1 id="peers-heading">Подключения</h1>
                <div className={rowStyles.actions}>
                    <IconButton compact icon="refresh" label={refreshing ? 'Обновление…' : 'Обновить'} onClick={() => void loadPeers(true)} disabled={refreshing} />
                    <IconButton compact icon="plus" label="Добавить подключение" variant="primary" onClick={() => setCreating(true)} />
                </div>
            </div>
            {loadError && <div className={`${layout.message} ${layout.error}`} role="alert">{loadError}</div>}
            {peers === null && !loadError && <p className={layout.message}>Загрузка подключений…</p>}
            {peers === null && loadError && <div className={layout.message}>
                <Button onClick={() => void loadPeers()}>Повторить</Button>
            </div>}
            {peers?.length === 0 && <p className={layout.message}>Подключений пока нет</p>}
            {peers && peers.length > 0 && <ul className={rowStyles.list} aria-label="Подключения">
                {peers.map(peer => <PeerRow key={peer.publicKey} peer={peer} onChanged={() => loadPeers(true)} />)}
            </ul>}

        </section>
        {creating && <CreatePeerForm onCreated={() => loadPeers(true)} onClose={() => setCreating(false)} />}
    </Shell>;
}
