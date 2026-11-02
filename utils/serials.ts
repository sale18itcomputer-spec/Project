/**
 * Serial-number helpers shared by the invoice / delivery-order editors and the serial picker.
 *
 * A line's serials are stored as one string. The picker emits newline-separated values, but
 * serials also arrive comma-separated (PO lines, pasted lists), so every consumer must split
 * on BOTH — splitting on newlines alone is how a whole comma list became a single "serial".
 */

export const parseSerials = (raw?: string | null): string[] =>
    (raw ?? '').split(/[\n,]/).map(s => s.trim()).filter(Boolean);

export interface SerialLine {
    /** Human label for error messages, e.g. `Line 2 – MSI MAG 342CQRF E20`. */
    label: string;
    qty: number | string | undefined | null;
    serialNumber?: string | null;
}

/**
 * Returns a message describing the first serial problem in a document, or null when clean.
 *
 * Rules (each one prevents serial/stock records drifting apart at sale time):
 *  - a line can't carry more serials than its quantity (selecting 5 serials on qty 1 would
 *    mark 5 units sold while only 1 is deducted from stock);
 *  - the same serial can't appear twice on one line or across lines of the same document.
 * Fewer serials than qty is allowed: stock that was never serialised at PO intake exists.
 */
export function findSerialProblem(lines: SerialLine[]): string | null {
    const seenOn = new Map<string, string>();
    for (const line of lines) {
        const serials = parseSerials(line.serialNumber);
        if (serials.length === 0) continue;

        const qty = Number(line.qty) || 0;
        if (serials.length > qty) {
            const extra = serials.length - qty;
            return `${line.label}: ${serials.length} serial numbers selected but the quantity is ${qty}. `
                + `Deselect ${extra} serial${extra === 1 ? '' : 's'} or raise the quantity.`;
        }

        for (const sn of serials) {
            const key = sn.toUpperCase();
            const prev = seenOn.get(key);
            if (prev !== undefined) {
                return prev === line.label
                    ? `${line.label}: serial ${sn} is listed twice.`
                    : `Serial ${sn} is used on both "${prev}" and "${line.label}".`;
            }
            seenOn.set(key, line.label);
        }
    }
    return null;
}
