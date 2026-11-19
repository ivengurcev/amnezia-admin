
import { useEffect, useState } from 'react';

import {
    ApiError,
    getSession,
    logout,
} from './api';

import App from './App';
import LoginForm from './LoginForm';
import Button from './ui/Button';
import layout from './Layout.module.css';

type Screen = 'loading' | 'login' | 'admin';

export default function Root() {
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
            <main className={layout.page}>
                {error ? (
                    <div className={`${layout.message} ${layout.error}`} role="alert">
                        {error}
                        <Button
                            onClick={() => window.location.reload()}
                        >
                            Повторить
                        </Button>
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
                <div className={layout.page}>
                    <div className={`${layout.message} ${layout.error}`} role="alert">
                        {error}
                    </div>
                </div>
            )}
            <App onLogout={() => void handleLogout()} />
        </>
    );
}

