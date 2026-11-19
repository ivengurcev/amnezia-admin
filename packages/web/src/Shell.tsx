import type { ReactNode } from 'react';
import Button from './ui/Button';
import styles from './Layout.module.css';

export default function Shell({ children, onLogout }: { children: ReactNode; onLogout?: () => void }) {
    return <>
        <header className={styles.topbar}>
            <div className={styles.topbarContent}>
                <span className={styles.brand}>Amnezia Admin</span>
                {onLogout && <Button onClick={onLogout}>Выйти</Button>}
            </div>
        </header>
        <main className={styles.page}>{children}</main>
    </>;
}
