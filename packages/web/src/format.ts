const byteUnits = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'medium',
});

export function formatBytes(bytes: number): string {
    if (bytes <= 0) {
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

export function formatHandshake(value: string | null): string {
    if (!value) {
        return 'Нет данных';
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? 'Нет данных'
        : dateFormatter.format(date);
}
