import React from 'react';
import { COMMERCIAL_SELLER, COMMERCIAL_TERMS } from '../../lib/pdf/commercialShared';

/**
 * Browser-print (Ctrl+P) layout for the Commercial Invoice (Yanet format). Mirrors
 * lib/pdf/buildCommercialInvoice.ts, which produces the preview / download / Telegram PDF, so
 * all of them show the same document. English only, no VAT, five columns.
 */
interface Item {
    no: number | string;
    itemCode?: string;
    modelName?: string;
    description?: string;
    qty: number | string;
    unitPrice?: number | string;
    amount?: number | string;
    isPromotion?: boolean;
    isPCBuild?: boolean;
    buildComponents?: { itemCode: string; modelName: string; qty: number | string; serialNumber?: string; warrantyMonths?: number }[];
    serialNumber?: string;
    serialNumbers?: string[];
}

interface Props {
    headerData: { [key: string]: any };
    items: Item[];
    totals: { subTotal: number };
    currency: 'USD' | 'KHR';
    signaturePadding?: number;
    hideSerials?: boolean;
}

const num = (v: unknown) => (typeof v === 'number' ? v : parseFloat(String(v)) || 0);
const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (ds?: string) => {
    if (!ds) return '';
    const d = new Date(ds + 'T00:00:00');
    return isNaN(d.getTime()) ? ds : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const BLUE = '#004aad';
const cell: React.CSSProperties = { border: '1px solid #000', padding: '4px 8px', fontSize: 12, textAlign: 'center', verticalAlign: 'top' };
const open: React.CSSProperties = { borderBottom: 'none' };
const inner: React.CSSProperties = { borderTop: 'none', borderBottom: 'none' };
const close: React.CSSProperties = { borderTop: 'none' };

const PrintableCommercialInvoice: React.FC<Props> = ({ headerData: hd, items, totals, currency, signaturePadding = 0, hideSerials = false }) => {
    const sym = currency === 'KHR' ? '៛' : '$';
    const money = (v: number | null, color?: string) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', whiteSpace: 'nowrap', color }}>
            <span>{sym}</span><span>{v !== null && v !== 0 ? fmt(v) : '-'}</span>
        </div>
    );
    const kv = (rows: [string, string][], right = false) => (
        <table style={{ borderCollapse: 'collapse', fontSize: 12, marginLeft: right ? 'auto' : undefined }}>
            <tbody>
                {rows.map(([k, v]) => (
                    <tr key={k}>
                        <td style={{ fontWeight: 'bold', whiteSpace: 'nowrap', padding: '3px 6px 3px 0', verticalAlign: 'top' }}>{k}</td>
                        <td style={{ width: 14, textAlign: 'center', verticalAlign: 'top' }}>:</td>
                        <td style={{ padding: '3px 0', whiteSpace: 'pre-line', verticalAlign: 'top' }}>{v}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    const deposit = num(hd['Deposit']);
    const subTotal = totals.subTotal;
    const rows = items.filter(i => Number(i.no) > 0 || i.isPromotion);

    const renderItem = (item: Item, idx: number) => {
        if (item.isPromotion) {
            const lines = ((item.description || item.modelName || '').trim() || 'Cashback / Promotion').split('\n');
            return lines.map((ln, i) => {
                const last = i === lines.length - 1;
                const st = lines.length === 1 ? {} : i === 0 ? open : last ? close : inner;
                return (
                    <tr key={`${idx}-p${i}`} style={{ breakInside: 'avoid' }}>
                        <td style={{ ...cell, ...st }} />
                        <td style={{ ...cell, ...st, textAlign: 'left', fontStyle: 'italic', color: '#666' }}>{ln}</td>
                        <td style={{ ...cell, ...st }} /><td style={{ ...cell, ...st }} />
                        <td style={{ ...cell, ...st }}>{last ? <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c00000' }}><span>{sym}</span><span>({fmt(Math.abs(num(item.amount)))})</span></div> : null}</td>
                    </tr>
                );
            });
        }
        const price = num(item.unitPrice);
        const amt = num(item.amount);
        const subs: { text: React.ReactNode; serial?: boolean }[] = [];
        if (item.isPCBuild && item.buildComponents?.length) {
            item.buildComponents.forEach(c => {
                const meta = [c.warrantyMonths ? `${c.warrantyMonths} months warranty` : '', !hideSerials && c.serialNumber ? `S/N: ${c.serialNumber}` : ''].filter(Boolean).join(' · ');
                subs.push({ text: <>{c.qty} × {c.modelName || c.itemCode}{meta && <div style={{ fontSize: 9, color: '#666' }}>{meta}</div>}</> });
            });
        } else {
            (item.description ? item.description.split('\n') : []).forEach(t => subs.push({ text: t }));
            if (!hideSerials) {
                const sns = (item.serialNumbers && item.serialNumbers.length ? item.serialNumbers : (item.serialNumber || '').split('\n')).map(s => s.trim()).filter(Boolean);
                sns.forEach(s => subs.push({ text: `S/N: ${s}`, serial: true }));
            }
        }
        const head = subs.length ? open : {};
        return (
            <React.Fragment key={idx}>
                <tr style={{ breakInside: 'avoid' }}>
                    <td style={{ ...cell, ...head }}>{item.no}</td>
                    <td style={{ ...cell, ...head, textAlign: 'left', fontWeight: 'bold' }}>{item.modelName || item.itemCode}</td>
                    <td style={{ ...cell, ...head }}>{item.qty}</td>
                    <td style={{ ...cell, ...head }}>{price > 0 ? money(price) : null}</td>
                    <td style={{ ...cell, ...head }}>{money(amt > 0 ? amt : null)}</td>
                </tr>
                {subs.map((s, i) => {
                    const st = i === subs.length - 1 ? close : inner;
                    return (
                        <tr key={`${idx}-s${i}`} style={{ breakInside: 'avoid' }}>
                            <td style={{ ...cell, ...st }} />
                            <td style={{ ...cell, ...st, textAlign: 'left', whiteSpace: 'pre-wrap', paddingTop: 1, fontSize: s.serial ? 10 : 11, color: s.serial ? '#555' : undefined }}>{s.text}</td>
                            <td style={{ ...cell, ...st }} /><td style={{ ...cell, ...st }} /><td style={{ ...cell, ...st }} />
                        </tr>
                    );
                })}
            </React.Fragment>
        );
    };

    const totalRow = (label: string, v: number | null) => (
        <tr style={{ breakInside: 'avoid' }}>
            <td colSpan={4} style={{ ...cell, fontWeight: 'bold', textAlign: 'right', verticalAlign: 'middle', padding: '6px 8px' }}>{label}</td>
            <td style={cell}>{money(v)}</td>
        </tr>
    );

    return (
        <div style={{ width: '210mm', margin: '0 auto', padding: '0 8px', fontFamily: "'Koh Santepheap', 'Times New Roman', serif", fontSize: 11, color: '#000' }}>
            <div style={{ borderBottom: `3px solid ${BLUE}`, padding: '14px 0 12px', textAlign: 'center', marginBottom: 18 }}>
                <div style={{ fontFamily: "'Times New Roman', serif", fontSize: 20, fontWeight: 'bold', marginBottom: 6 }}>{COMMERCIAL_SELLER.name}</div>
                <div style={{ fontSize: 10.5, marginBottom: 3 }}>Address : {COMMERCIAL_SELLER.address}</div>
                <div style={{ fontSize: 10.5 }}>Tel : {COMMERCIAL_SELLER.tel}</div>
            </div>
            <div style={{ fontFamily: "'Times New Roman', serif", fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 18, letterSpacing: 0.5 }}>INVOICE</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
                <div style={{ width: '58%' }}>
                    <div style={{ fontWeight: 'bold', fontSize: 12, textDecoration: 'underline', marginBottom: 4 }}>Buyer :</div>
                    {kv([
                        ['Customer Name', hd['Company Name'] || hd['Customer'] || ''],
                        ['Phone Number', hd['Phone Number'] || hd['Telephone'] || ''],
                        ['Address', hd['Company Address'] || hd['Address'] || ''],
                    ])}
                </div>
                <div style={{ width: '40%' }}>
                    {kv([
                        ['Invoice N°', hd['Inv No.'] || hd['Inv No'] || hd['Invoice No'] || ''],
                        ['Date', fmtDate(hd['Inv Date'] || hd['Invoice Date'])],
                        ['Due Date', fmtDate(hd['Due Date'])],
                    ], true)}
                </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup><col style={{ width: '6%' }} /><col style={{ width: '50%' }} /><col style={{ width: '12%' }} /><col style={{ width: '16%' }} /><col style={{ width: '16%' }} /></colgroup>
                <thead>
                    <tr>
                        {['No.', 'Description', 'Qty', 'Unit Price', 'Amount'].map(h => (
                            <th key={h} style={{ background: BLUE, color: '#fff', border: '1px solid #000', padding: '7px 8px', fontSize: 12, textAlign: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>{rows.map(renderItem)}</tbody>
                <tfoot>
                    {totalRow('Total', subTotal > 0 ? subTotal : null)}
                    {deposit > 0 && totalRow('Deposit', deposit)}
                    {deposit > 0 && totalRow('Total Less Deposit', subTotal - deposit > 0 ? subTotal - deposit : null)}
                </tfoot>
            </table>

            {/* Same terms text as the PDF builder (shared constant, so the two cannot drift) */}
            <div style={{ fontSize: 10.5, marginTop: 14, breakInside: 'avoid' }}>
                <div style={{ fontSize: 11.5, fontWeight: 'bold', textDecoration: 'underline', textTransform: 'uppercase', marginBottom: 6 }}>Terms and Condition:</div>
                <ul style={{ margin: 0, paddingLeft: 16, listStyleType: 'disc' }}>
                    {COMMERCIAL_TERMS.map(t => (
                        <li key={t.label} style={{ marginBottom: 3, lineHeight: 1.4 }}><b>{t.label}:</b> {t.text}</li>
                    ))}
                </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px', marginTop: signaturePadding, breakInside: 'avoid' }}>
                {[
                    { label: "Seller's Signature & Name", name: hd['Prepared By'], pos: hd['Prepared By Position'] },
                    { label: "Customer's Signature & Name", name: '', pos: '' },
                ].map(s => (
                    <div key={s.label} style={{ width: '36%', textAlign: 'center' }}>
                        <div style={{ height: 70 }} />
                        <div style={{ borderTop: '2px solid #000', marginBottom: 6 }} />
                        {s.name ? <div style={{ fontWeight: 'bold', fontSize: 11.5 }}>{s.name}</div> : null}
                        {s.pos ? <div style={{ fontSize: 11.5 }}>{s.pos}</div> : null}
                        <div style={{ fontWeight: 'bold', fontSize: 11.5 }}>{s.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PrintableCommercialInvoice;
