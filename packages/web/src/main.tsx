
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
    ApiError,
    getSession,
    logout,
} from './api';

import App from './App';
import LoginForm from './LoginForm';
import './styles.css';

type Screen = 'loading' | 'login' | 'admin';

function Root() {
    const [screen, setScreen] = useState<Screen>('loading');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        getSession()
            .then(() => {
                if (!cancelled) {
                    setScreen('admin');
                }
            })
            .catch((err: unknown) => {
                if (cancelled) return;

                if (err instanceof ApiError && err.status === 401) {
                    setScreen('login');
                    return;
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : 'Не удалось проверить сессию'
                );
            });

        return () => {
            cancelled = true;
        };
    }, []);

    async function handleLogout() {
        try {
            await logout();
            setError(null);
            setScreen('login');
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Не удалось выйти'
            );
        }
    }

    if (screen === 'loading') {
        return (
            <main className="page">
                {error ? (
                    <div className="message message--error" role="alert">
                        {error}
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                        >
                            Повторить
                        </button>
                    </div>
                ) : (
                    <p>Проверка сессии…</p>
                )}
            </main>
        );
    }

    if (screen === 'login') {
        return (
            <LoginForm
                onLogin={() => {
                    setError(null);
                    setScreen('admin');
                }}
            />
        );
    }

    return (
        <>
            {error && (
                <div className="page">
                    <div className="message message--error" role="alert">
                        {error}
                    </div>
                </div>
            )}
            <App onLogout={() => void handleLogout()} />
        </>
    );
}

const root = document.getElementById('root');

if (!root) {
    throw new Error('Root element not found');
}

createRoot(root).render(
    <StrictMode>
        <Root />
    </StrictMode>,
);
