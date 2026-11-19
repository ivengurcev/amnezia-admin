
import { useState } from 'react';
import type { FormEvent } from 'react';
import { checkCredentials } from './api';
import Shell from './Shell';
import Button from './ui/Button';
import Input from './ui/Input';
import layout from './Layout.module.css';
import styles from './LoginForm.module.css';

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

        if (loading) return;
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

    return <Shell>
        <section className={`${layout.panel} ${styles.panel}`}>
            <div className={layout.panelHeader}>
                <div>
                    <p className={layout.eyebrow}>Администрирование VPN</p>
                    <h1>Вход</h1>
                </div>
            </div>
            <form className={`${layout.form} ${styles.form}`} onSubmit={handleSubmit}>
                <Input label="Публичный ключ" autoComplete="username" value={publicKey}
                    onChange={event => setPublicKey(event.target.value)} disabled={loading} required />
                <Input label="Пароль" type="password" autoComplete="current-password" value={password}
                    onChange={event => setPassword(event.target.value)} disabled={loading} required />
                {error && <p className={layout.errorText} role="alert">{error}</p>}
                <Button variant="primary" type="submit" disabled={loading}>{loading ? 'Проверка…' : 'Войти'}</Button>
            </form>
        </section>
    </Shell>;
}
