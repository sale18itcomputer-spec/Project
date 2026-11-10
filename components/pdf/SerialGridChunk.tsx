import React from 'react';
import { serialGridHeading, serialGridStyle } from '../../lib/pdf/serialGrid';

/**
 * React twin of serialGridChunksHtml (lib/pdf/serialGrid.ts) for the live document previews: one
 * chunk of a long serial list as a compact grid inside the item's description cell.
 */
const SerialGridChunk: React.FC<{
    chunk: string[];
    minCellPx: number;
    /** Total serial count — shown as the "S/N (n)" heading on the first chunk only. */
    headingCount?: number;
}> = ({ chunk, minCellPx, headingCount }) => (
    <>
        {headingCount !== undefined && (
            <div style={{ fontSize: 9, fontWeight: 'bold', color: '#444', marginBottom: 2 }}>{serialGridHeading(headingCount)}</div>
        )}
        <div style={serialGridStyle(minCellPx) as React.CSSProperties}>
            {chunk.map((s, i) => <span key={i}>{s}</span>)}
        </div>
    </>
);

export default SerialGridChunk;
