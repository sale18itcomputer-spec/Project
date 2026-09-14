/**
 * itemCode.ts — new-item code generation for the pricelist.
 *
 * Existing codes are a loosely-followed 3-letter prefix + running number
 * (SNB…, MVG…). For NEW items we generate `<PREFIX><5-digit>` where the number
 * is (max existing suffix for that prefix + 1), guaranteed unique across the
 * whole pricelist. Existing codes are never touched.
 */

export interface ItemTypeDef {
    label: string;    // shown in the "Item Type" dropdown
    prefix: string;   // code prefix (uppercase)
    category: string; // coarse Category auto-filled on the pricelist item
}

// The item-type → prefix map (confirmed convention). Add/rename here as the
// catalog grows; existing codes are unaffected.
export const ITEM_TYPES: ItemTypeDef[] = [
    { label: 'CPU / Processor',     prefix: 'CPU', category: 'Components & Parts' },
    { label: 'GPU / Graphics card', prefix: 'GPU', category: 'Components & Parts' },
    { label: 'Motherboard',         prefix: 'MBD', category: 'Components & Parts' },
    { label: 'RAM / Memory',        prefix: 'RAM', category: 'Components & Parts' },
    { label: 'SSD',                 prefix: 'SSD', category: 'Components & Parts' },
    { label: 'HDD',                 prefix: 'HDD', category: 'Components & Parts' },
    { label: 'Power supply (PSU)',  prefix: 'PSU', category: 'Components & Parts' },
    { label: 'Case / Chassis',      prefix: 'CSE', category: 'Components & Parts' },
    { label: 'Cooler / Fan',        prefix: 'FAN', category: 'Components & Parts' },
    { label: 'Laptop / Notebook',   prefix: 'NBK', category: 'Laptops & Notebooks' },
    { label: 'Desktop / AIO',       prefix: 'PCD', category: 'Desktops & All-In-Ones' },
    { label: 'Monitor / Display',   prefix: 'MON', category: 'Monitors & Displays' },
    { label: 'Networking',          prefix: 'NET', category: 'Networking & Connectivity' },
    { label: 'UPS / Power backup',  prefix: 'UPS', category: 'Power Backup (UPS)' },
    { label: 'Accessory',           prefix: 'ACC', category: 'Accessories' },
    { label: 'Projector',           prefix: 'PRJ', category: 'Projectors & Accessories' },
    { label: 'Other',               prefix: 'OTH', category: 'Other Accessories' },
];

const PAD = 5;

/**
 * Next unique code for a prefix: `<PREFIX>` + zero-padded (max existing suffix
 * for that prefix + 1). Scans all existing codes so it never collides — even if
 * the prefix already exists with gaps. `existingCodes` should be every current
 * pricelist Code.
 */
export function getNextItemCode(prefix: string, existingCodes: Array<string | null | undefined>): string {
    const P = (prefix || '').trim().toUpperCase();
    if (!P) return '';
    const used = new Set(
        existingCodes.map(c => (c ?? '').trim().toUpperCase()).filter(Boolean),
    );
    const re = new RegExp(`^${P}(\\d+)$`);
    let max = 0;
    for (const c of used) {
        const m = c.match(re);
        if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    let n = max + 1;
    let code = `${P}${String(n).padStart(PAD, '0')}`;
    // Defensive: skip any full-code collision (e.g. a non-sequential dupe).
    while (used.has(code)) {
        n += 1;
        code = `${P}${String(n).padStart(PAD, '0')}`;
    }
    return code;
}
