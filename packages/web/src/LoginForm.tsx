
import { useState } from 'react';
import type { FormEvent } from 'react';
import { checkCredentials } from './api';

type LoginFormProps = {
    onLogin: () => void;
};

export default function LoginForm({ onLogin }: LoginFormProps) {
    const [publicKey, setPublicKey] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError('');
        setLoading(true);

        try {
            await checkCredentials(
                publicKey.trim(),
                password,
            );

            setPassword('');
            onLogin();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Ошибка авторизации'
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <header className="topbar">
                <div className="topbar__content">
                    <span className="brand">Amnezia Admin</span>
                </div>
            </header>

            <main className="page auth-page">
                <section className="section">
                    <div className="section__header">
                        <div>
                            <p className="eyebrow">Администрирование VPN</p>
                            <h1>Вход</h1>
                        </div>
                    </div>

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="field">
                            <label htmlFor="publicKey">
                                Публичный ключ
                            </label>
                            <input
                                id="publicKey"
                                autoComplete="username"
                                value={publicKey}
                                onChange={(e) =>
                                    setPublicKey(e.target.value)
                                }
                                required
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="password">
                                Пароль
                            </label>
                            <input
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) =>
                                    setPassword(e.target.value)
                                }
                                required
                            />
                        </div>

                        {error && (
                            <p className="form-error" role="alert">
                                {error}
                            </p>
                        )}

                        <button
                            className="button--primary"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Проверка…' : 'Войти'}
                        </button>
                    </form>
                </section>
            </main>
        </>
    );
}
