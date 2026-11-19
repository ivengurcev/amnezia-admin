import Button from './Button';
import type { ButtonProps } from './Button';
import styles from './Controls.module.css';

type Props = Omit<ButtonProps, 'children'> & { label: string; icon: 'link' | 'delete' };

export default function IconButton({ label, icon, ...props }: Props) {
    return (
        <Button {...props} className={styles.icon} aria-label={label} title={label}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                {icon === 'link' ? <>
                    <path d="m10 13 4-4M8 16l-1 1a4.24 4.24 0 0 1-6-6l4-4a4.24 4.24 0 0 1 6 0" transform="translate(3 0)" />
                    <path d="m16 8 1-1a4.24 4.24 0 0 1 6 6l-4 4a4.24 4.24 0 0 1-6 0" transform="translate(-3 0)" />
                </> : <>
                    <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
                </>}
            </svg>
        </Button>
    );
}
