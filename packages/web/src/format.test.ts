import { describe, expect, it } from 'vitest';

import { formatBytes, formatHandshake } from './format';

describe('formatBytes', () => {
    it.each([
        [0, '0 Б'],
        [1024, '1 КБ'],
        [1536, '1,5 КБ'],
        [1024 * 1024, '1 МБ'],
    ])('formats %d bytes as %s', (value, expected) => {
        expect(formatBytes(value)).toBe(expected);
    });
});

describe('formatHandshake', () => {
    it('shows no data for null and invalid timestamps', () => {
        expect(formatHandshake(null)).toBe('Нет данных');
        expect(formatHandshake('not-a-date')).toBe('Нет данных');
    });

    it('formats a valid timestamp in Russian locale', () => {
        const result = formatHandshake(
            '2026-09-22T10:00:00.000Z',
        );

        expect(result).not.toBe('Нет данных');
        expect(result).not.toContain('Invalid');
    });
});
