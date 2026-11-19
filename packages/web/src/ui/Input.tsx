import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import styles from './Controls.module.css';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string };

export default function Input({ label, id, className = '', ...props }: Props) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return <div className={styles.field}>
        <label className={styles.label} htmlFor={inputId}>{label}</label>
        <input id={inputId} className={`${styles.input} ${className}`} {...props} />
    </div>;
}
