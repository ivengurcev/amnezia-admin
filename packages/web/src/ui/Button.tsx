import type { ButtonHTMLAttributes } from 'react';
import styles from './Controls.module.css';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'danger';
};

export default function Button({ variant = 'secondary', className = '', type = 'button', ...props }: ButtonProps) {
    return <button type={type} className={`${styles.button} ${styles[variant]} ${className}`} {...props} />;
}
