import {
    useState,
} from 'react';
import type { FormEvent } from 'react';

import { createPeer } from './api';

type CreatePeerFormProps = {
    onCreated: () => Promise<void>;
};

const nameError = 'Имя должно содержать от 1 до 100 символов';

function getErrorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : 'Не удалось создать peer';
}

function safeConfigFilename(name: string): string {
    const safeName = name
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return `${safeName || 'amnezia-peer'}.conf`;
}

function downloadConfig(name: string, config: string): void {
    const url = URL.createObjectURL(new Blob([config], {
        type: 'text/plain;charset=utf-8',
    }));
    const link = document.createElement('a');

    link.href = url;
    link.download = safeConfigFilename(name);
    document.body.append(link);

    try {
        link.click();
    } finally {
        link.remove();
        URL.revokeObjectURL(url);
    }
}

export default function CreatePeerForm({
    onCreated,
}: CreatePeerFormProps) {
    const [name, setName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();

        const normalizedName = name.trim();

        if (
            normalizedName.length === 0 ||
            normalizedName.length > 100
        ) {
            setError(nameError);
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const peer = await createPeer(normalizedName);

            downloadConfig(peer.name, peer.config);
            setName('');
            await onCreated();
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form className="create-form" onSubmit={handleSubmit}>
            <div className="field">
                <label htmlFor="peer-name">Имя peer</label>
                <input
                    id="peer-name"
                    name="name"
                    value={name}
                    onChange={(event) => {
                        setName(event.target.value);
                        setError(null);
                    }}
                    disabled={submitting}
                    aria-describedby={error
                        ? 'create-peer-error'
                        : undefined}
                />
                {error && (
                    <span
                        className="form-error"
                        id="create-peer-error"
                        role="alert"
                    >
                        {error}
                    </span>
                )}
            </div>
            <button
                className="button--primary"
                type="submit"
                disabled={submitting}
            >
                {submitting ? 'Создание…' : 'Создать peer'}
            </button>
        </form>
    );
}
