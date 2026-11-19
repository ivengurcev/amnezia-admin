import type { ReactNode } from 'react';

const paths = {
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    link: <><path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>,
    delete: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />,
    admin: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    online: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    offline: <><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    download: <path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4" />,
    upload: <path d="M12 15V3M7 8l5-5 5 5M5 17v4h14v-4" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export default function Icon({ name, label }: { name: IconName; label?: string }) {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false"
        role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        {label && <title>{label}</title>}
        {paths[name]}
    </svg>;
}
