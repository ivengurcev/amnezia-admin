import {
    useState,
} from 'react';
import type { FormEvent } from 'react';

import {
    deletePeer,
    renamePeer,
} from './api';
import type { Peer } from './api';
import { formatBytes, formatHandshake } from './format';

type PeerRowProps = {
    peer: Peer;
    onChanged: () => Promise<void>;
};

type Operation = 'rename' | 'delete' | null;

const nameError = 'Имя должно содержать от 1 до 100 символов';
const unavailableTitle = 'Действия недоступны: у peer нет API UUID';

function getErrorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : 'Не удалось выполнить операцию';
}

export default function PeerRow({
    peer,
    onChanged,
}: PeerRowProps) {
    const [editing, setEditing] = useState(false);
    const [draftName, setDraftName] = useState(peer.name);
    const [operation, setOperation] = useState<Operation>(null);
    const [error, setError] = useState<string | null>(null);

    const actionsDisabled = !peer.id || operation !== null;

    async function handleRename(
        event: FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();

        if (!peer.id) {
            return;
        }

        const normalizedName = draftName.trim();

        if (
            normalizedName.length === 0 ||
            normalizedName.length > 100
        ) {
            setError(nameError);
            return;
        }

        setOperation('rename');
        setError(null);

        try {
            await renamePeer(peer.id, normalizedName);
            await onChanged();
            setEditing(false);
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setOperation(null);
        }
    }

    async function handleDelete(): Promise<void> {
        if (
            !peer.id ||
            !window.confirm(`Удалить peer «${peer.name}»?`)
        ) {
            return;
        }

        setOperation('delete');
        setError(null);

        try {
            await deletePeer(peer.id);
            await onChanged();
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setOperation(null);
        }
    }

    return (
        <article className="peer-row">
            <div
                className="peer-cell peer-cell--name"
                data-label="Имя"
            >
                <span className="visually-hidden">Имя:</span>
                {editing ? (
                    <form
                        className="rename-form"
                        onSubmit={handleRename}
                    >
                        <label className="visually-hidden" htmlFor={
                            `peer-name-${peer.publicKey}`
                        }>
                            Новое имя
                        </label>
                        <input
                            id={`peer-name-${peer.publicKey}`}
                            value={draftName}
                            onChange={(event) => {
                                setDraftName(event.target.value);
                                setError(null);
                            }}
                            disabled={operation !== null}
                        />
                        <button
                            className="button--primary"
                            type="submit"
                            disabled={operation !== null}
                        >
                            {operation === 'rename'
                                ? 'Сохранение…'
                                : 'Сохранить'}
                        </button>
                        <button
                            className="button--secondary"
                            type="button"
                            disabled={operation !== null}
                            onClick={() => {
                                setDraftName(peer.name);
                                setEditing(false);
                                setError(null);
                            }}
                        >
                            Отмена
                        </button>
                    </form>
                ) : (
                    <strong>{peer.name}</strong>
                )}
            </div>
            <div className="peer-cell" data-label="Адрес">
                <span className="visually-hidden">Адрес:</span>
                {peer.address}
            </div>
            <div className="peer-cell" data-label="Статус">
                <span className="visually-hidden">Статус:</span>
                <span className={
                    `status status--${peer.connected
                        ? 'online'
                        : 'offline'}`
                }>
                    {peer.connected
                        ? 'Подключён'
                        : 'Не подключён'}
                </span>
            </div>
            <div className="peer-cell" data-label="Handshake">
                <span className="visually-hidden">Handshake:</span>
                {formatHandshake(peer.latestHandshakeAt)}
            </div>
            <div className="peer-cell" data-label="RX">
                <span className="visually-hidden">RX:</span>
                {formatBytes(peer.rxBytes)}
            </div>
            <div className="peer-cell" data-label="TX">
                <span className="visually-hidden">TX:</span>
                {formatBytes(peer.txBytes)}
            </div>
            <div
                className="peer-actions"
                data-label="Действия"
                title={peer.id ? undefined : unavailableTitle}
            >
                <button
                    className="button--secondary"
                    type="button"
                    disabled={actionsDisabled}
                    onClick={() => {
                        setDraftName(peer.name);
                        setEditing(true);
                        setError(null);
                    }}
                >
                    Переименовать
                </button>
                <button
                    className="button--danger"
                    type="button"
                    disabled={actionsDisabled}
                    onClick={() => void handleDelete()}
                >
                    {operation === 'delete'
                        ? 'Удаление…'
                        : 'Удалить'}
                </button>
            </div>
            {error && (
                <div className="peer-error" role="alert">
                    {error}
                </div>
            )}
        </article>
    );
}
