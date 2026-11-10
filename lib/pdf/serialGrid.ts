/**
 * Compact serial-number layout shared by every printed document (invoice, commercial invoice,
 * delivery note) and by their live React previews.
 *
 * One serial per line is fine for a handful of units, but a 52-unit laptop order printed that way
 * fills most of a page and 100+ units spill onto a second one. From SERIAL_GRID_THRESHOLD serials
 * up, the list is instead printed as a monospace grid INSIDE the item's description cell (the
 * delivery note's own Serial Number cell): the number of columns follows the cell width and the
 * longest serial, so no per-document tuning.
 *
 * The grid is split into chunks (one sub-row each) so a very long list can still break across
 * pages between chunks instead of being forced onto one page.
 */
import { esc } from './shared-pure';

export const SERIAL_GRID_THRESHOLD = 7;

/** Serials per sub-row: ~15-30 grid lines, short enough to never exceed a page, and divisible by
 *  2/3/4/5/6 columns so a chunk boundary never leaves a half-empty grid row. */
const CHUNK_SIZE = 60;
/** Width of one monospace character at the 9px grid font, with headroom for fallback fonts. */
const CHAR_PX = 5.5;
const GRID_FONT = "Consolas, 'Courier New', monospace";

export const serialGridApplies = (count: number): boolean => count >= SERIAL_GRID_THRESHOLD;

export function serialGridLayout(serials: string[], chunkSize = CHUNK_SIZE): { minCellPx: number; chunks: string[][] } {
    const maxLen = serials.reduce((m, s) => Math.max(m, s.length), 0);
    const chunks: string[][] = [];
    for (let i = 0; i < serials.length; i += chunkSize) chunks.push(serials.slice(i, i + chunkSize));
    return { minCellPx: Math.ceil(maxLen * CHAR_PX) + 10, chunks };
}

/** Style of the grid container (camelCase, usable as a React style object). */
export const serialGridStyle = (minCellPx: number): Record<string, string | number> => ({
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${minCellPx}px, 1fr))`,
    columnGap: 4,
    rowGap: 1,
    fontFamily: GRID_FONT,
    fontSize: 9,
    lineHeight: 1.3,
    color: '#444',
    textAlign: 'left',
    wordBreak: 'break-all',
});

export const serialGridHeading = (count: number): string => `S/N (${count})`;

const toCss = (style: Record<string, string | number>): string =>
    Object.entries(style)
        .map(([k, v]) => `${k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}:${typeof v === 'number' && !/line|opacity/i.test(k) ? `${v}px` : v}`)
        .join(';');

/**
 * The grid as HTML, one string per chunk, for the HTML (server / PDF) builders. Each chunk goes
 * into its own description sub-row; the first carries the "S/N (n)" heading unless `heading` is off.
 * `chunked: false` returns one single grid (for a cell that can't be split into sub-rows).
 */
export function serialGridChunksHtml(serials: string[], heading = true, chunked = true): string[] {
    const { minCellPx, chunks } = serialGridLayout(serials, chunked ? CHUNK_SIZE : Math.max(serials.length, 1));
    const grid = toCss(serialGridStyle(minCellPx));
    return chunks.map((chunk, ci) =>
        `${ci === 0 && heading ? `<div style="font-size:9px;font-weight:bold;color:#444;margin-bottom:2px;">${serialGridHeading(serials.length)}</div>` : ''}<div style="${grid}">${chunk.map(s => `<span>${esc(s)}</span>`).join('')}</div>`);
}
