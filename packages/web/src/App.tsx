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

function getErrorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : 'Не удалось выполнить запрос';
}

export default function App() {
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

    return (
        <>
            <header className="topbar">
                <div className="topbar__content">
                    <span className="brand">Amnezia Admin</span>
                </div>
            </header>
            <main className="page">
                <section
                    className="section"
                    aria-labelledby="peers-heading"
                >
                    <div className="section__header">
                        <div>
                            <p className="eyebrow">
                                Управление доступом
                            </p>
                            <h1 id="peers-heading">Peers</h1>
                        </div>
                        <button
                            className="button--secondary"
                            type="button"
                            onClick={() => void loadPeers(true)}
                            disabled={refreshing}
                        >
                            {refreshing
                                ? 'Обновление…'
                                : 'Обновить'}
                        </button>
                    </div>

                    <CreatePeerForm
                        onCreated={() => loadPeers(true)}
                    />

                    {loadError && (
                        <div
                            className="message message--error"
                            role="alert"
                        >
                            {loadError}
                        </div>
                    )}

                    {peers === null && !loadError && (
                        <p className="message">Загрузка peers…</p>
                    )}

                    {peers === null && loadError && (
                        <div className="message">
                            <button
                                className="button--secondary"
                                type="button"
                                onClick={() => void loadPeers()}
                            >
                                Повторить
                            </button>
                        </div>
                    )}

                    {peers?.length === 0 && (
                        <p className="message">Peers пока нет</p>
                    )}

                    {peers && peers.length > 0 && (
                        <div className="peer-list">
                            <div
                                className="peer-header"
                                aria-hidden="true"
                            >
                                <span>Имя</span>
                                <span>Адрес</span>
                                <span>Статус</span>
                                <span>Handshake</span>
                                <span>RX</span>
                                <span>TX</span>
                                <span>Действия</span>
                            </div>
                            {peers.map((peer) => (
                                <PeerRow
                                    key={peer.publicKey}
                                    peer={peer}
                                    onChanged={() => loadPeers(true)}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </>
    );
}
