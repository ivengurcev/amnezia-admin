export function getNextFreeAddress(
    usedAddresses: string[],
    subnetPrefix = '10.90.0',
): string {
    const used = new Set(usedAddresses);

    for (let host = 2; host <= 254; host++) {
        const address = `${subnetPrefix}.${host}`;

        if (!used.has(address)) {
            return address;
        }
    }

    throw new Error('No free IP addresses available');
}
