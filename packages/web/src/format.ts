const byteUnits = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'medium',
});

export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '0 Б';
    }

    const unitIndex = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        byteUnits.length - 1,
    );
    const value = bytes / 1024 ** unitIndex;

    return `${new Intl.NumberFormat('ru-RU', {
        maximumFractionDigits: 1,
    }).format(value)} ${byteUnits[unitIndex]}`;
}

export function formatHandshake(value: number): string {
    const date = new Date(value * 1000);

    return !Number.isFinite(value) || value <= 0 || Number.isNaN(date.getTime())
        ? 'Нет данных'
        : dateFormatter.format(date);
}

export function isConnected(handshake: number, now = Date.now()): boolean {
    const age = now / 1000 - handshake;
    return handshake > 0 && Number.isFinite(handshake) && age >= 0 && age <= 180;
}

export function formatVpnIp(allowedIps: string): string {
    return /^\d{1,3}(?:\.\d{1,3}){3}\/32$/.test(allowedIps)
        ? allowedIps.slice(0, -3)
        : allowedIps;
}
