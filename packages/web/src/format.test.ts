import { describe, expect, it } from 'vitest';
import { formatBytes, formatHandshake, formatVpnIp, isConnected } from './format';

describe('formatBytes', () => {
    it.each([[0, '0 Б'], [1024, '1 КБ'], [1536, '1,5 КБ'], [1048576, '1 МБ'], [-1, '0 Б'], [NaN, '0 Б']])(
        'formats %s bytes', (value, expected) => expect(formatBytes(value)).toBe(expected),
    );
});
describe('handshake', () => {
    it.each([0, -1, NaN, Infinity])('shows no data for %s', value => {
        expect(formatHandshake(value)).toBe('Нет данных');
    });
    it('formats Unix seconds as local Russian date and time', () => {
        const value = 1790000000;
        expect(formatHandshake(value)).toBe(new Intl.DateTimeFormat('ru-RU', {
            dateStyle: 'short', timeStyle: 'medium',
        }).format(new Date(value * 1000)));
    });
    it.each([[1000, true], [820, true], [819, false], [0, false], [1001, false], [NaN, false]])(
        'determines status from timestamp %s at time 1000', (value, expected) => {
            expect(isConnected(value, 1000 * 1000)).toBe(expected);
        },
    );
});
describe('VPN IP', () => {
    it('omits a host mask and preserves routed networks', () => {
        expect(formatVpnIp('10.90.0.2/32')).toBe('10.90.0.2');
        expect(formatVpnIp('10.90.0.0/24')).toBe('10.90.0.0/24');
        expect(formatVpnIp('10.90.0.2/32, 10.91.0.0/24')).toBe('10.90.0.2/32, 10.91.0.0/24');
    });
});
