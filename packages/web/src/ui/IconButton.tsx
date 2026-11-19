import Button from './Button';
import type { ButtonProps } from './Button';
import Icon from './Icon';
import styles from './Controls.module.css';

type Props = Omit<ButtonProps, 'children'> & { label: string; icon: 'link' | 'delete' | 'refresh' | 'plus'; compact?: boolean };

export default function IconButton({ label, icon, compact = false, ...props }: Props) {
    return <Button {...props} className={`${styles.icon} ${compact ? styles.compact : ''}`} aria-label={label} title={label}>
        <Icon name={icon} />
    </Button>;
}
