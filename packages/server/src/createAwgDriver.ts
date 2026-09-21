import type { AwgDriver } from './awg.js';
import { MockAwgDriver } from './MockAwgDriver.js';
import { RealAwgDriver } from './RealAwgDriver.js';

export function createAwgDriver(): AwgDriver {
    const driver = process.env.AWG_DRIVER ?? 'mock';

    if (driver === 'mock') {
        return new MockAwgDriver();
    }

    if (driver === 'real') {
        return new RealAwgDriver(
            process.env.AWG_BINARY ?? 'awg',
            process.env.AWG_INTERFACE ?? 'wg0',
        );
    }

    throw new Error(`Unknown AWG_DRIVER: ${driver}`);
}
