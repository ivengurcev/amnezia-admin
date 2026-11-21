
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { checkCredentials, getAuthMode } from './api';
import type { AuthMode } from './api';
import Shell from './Shell';
import Button from './ui/Button';
import Input from './ui/Input';
import layout from './Layout.module.css';
import styles from './LoginForm.module.css';

type LoginFormProps = {
    onLogin: () => void;
};



export default function LoginForm({ onLogin }: LoginFormProps) {
    const [mode, setMode] = useState<AuthMode | null>(null);
    const [modeError, setModeError] = useState('');
    const [modeAttempt, setModeAttempt] = useState(0);
    const [publicKey, setPublicKey] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setModeError('');

        getAuthMode()
            .then(nextMode => {
                if (!cancelled) setMode(nextMode);
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setModeError(err instanceof Error ? err.message : 'Не удалось получить режим авторизации');
                }
            });

        return () => { cancelled = true; };
    }, [modeAttempt]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (loading || !mode) return;
        setError('');
        setLoading(true);

        try {
            await checkCredentials(
                mode.publicKeyRequired ? publicKey.trim() : undefined,
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

    return <Shell>
        <section className={`${layout.panel} ${styles.panel}`}>
            <div className={layout.panelHeader}>
                <div>
                    <p className={layout.eyebrow}>Администрирование VPN</p>
                    <h1>Вход</h1>
                </div>
            </div>
            {mode === null ? <div className={`${layout.form} ${styles.form}`}>
                {modeError ? <>
                    <p className={layout.errorText} role="alert">{modeError}</p>
                    <Button onClick={() => setModeAttempt(attempt => attempt + 1)}>Повторить</Button>
                </> : <p role="status">Загрузка режима входа…</p>}
            </div> : <form className={`${layout.form} ${styles.form}`} onSubmit={handleSubmit}>
                {mode.publicKeyRequired && <Input label="Публичный ключ" autoComplete="username" value={publicKey}
                    onChange={event => setPublicKey(event.target.value)} disabled={loading} required />}
                <Input label="Пароль" type="password" autoComplete="current-password" value={password}
                    onChange={event => setPassword(event.target.value)} disabled={loading} required />
                {error && <p className={layout.errorText} role="alert">{error}</p>}
                <Button variant="primary" type="submit" disabled={loading}>{loading ? 'Проверка…' : 'Войти'}</Button>
            </form>}
        </section>
    </Shell>;
}
