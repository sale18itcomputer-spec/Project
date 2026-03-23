'use client';

import React, { useState, useCallback, useRef } from 'react';

// ── Default layout values (mirrors pdfTemplate.ts LAYOUT) ─────────────────
const DEFAULT_LAYOUT = {
  customerInfo: {
    fontSize: 9,
    rowGap: 5,
    colLabel: 90,
    colColon: 12,
    colRightLabel: 110,
    colRightValue: 120,
  },
  table: {
    colNo: 7,
    colCode: 17,
    colDesc: 46,
    colQty: 6,
    colPrice: 10,
    colTotal: 14,
  },
  margins: {
    top: 10,
    right: 11,
    bottom: 14,
    left: 11,
  },
  title: {
    fontSize: 16,
    marginTop: 3,
    marginBottom: 5,
  },
  terms: {
    spacingAbove: 7,
    titleFontSize: 9,
    contentFontSize: 9,
  },
};

type Layout = typeof DEFAULT_LAYOUT;

// ── Sample data for preview ────────────────────────────────────────────────
const SAMPLE = {
  companyName: 'Cambodia Post Bank Plc.',
  address: 'Building No 263, 1st 6th Floor, Street No 110 corner 61, Group 11, Phum 1, Sangkat Vat Phnum, Khan Doun Penh, Phnom Penh.',
  quotationNo: 'Q-0000044',
  quoteDate: '23 March 2026',
  contactPerson: 'Ms. Ly Kimlay',
  validity: '30 March 2026',
  tel: '070 6000 71',
  status: 'Lead-Time (1week)',
  email: 'kimlay.ly@cambodiapostbank.com',
  paymentTerm: 'Credit 7days',
};

const SAMPLE_ITEMS = [
  { no: 1, code: 'LEN-TB-X1C', model: 'ThinkPad X1 Carbon Gen 12', desc: 'Intel Core Ultra 7 155U, 16GB RAM, 512GB SSD, 14" 2.8K OLED', qty: 2, price: 1899.00, amount: 3798.00 },
  { no: 2, code: 'LEN-V15-G4', model: 'Lenovo V15 G4 IRU', desc: 'Intel Core i5-1335U, 8GB RAM, 256GB SSD, 15.6" FHD', qty: 5, price: 649.00, amount: 3245.00 },
  { no: 3, code: 'LEN-MON-27', model: 'Lenovo L27i-40 Monitor', desc: '27" FHD IPS, 100Hz, HDMI, VGA', qty: 3, price: 189.00, amount: 567.00 },
];

// ── Slider row component ───────────────────────────────────────────────────
function SliderRow({ label, value, min, max, step = 1, onChange, unit = 'px' }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-32 text-xs text-gray-600 shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 accent-blue-600"
      />
      <span className="w-14 text-xs font-mono text-right text-blue-700 shrink-0">{value}{unit}</span>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-4 mb-1 pb-1 border-b border-gray-200">
      {children}
    </div>
  );
}

// ── Copy-to-clipboard helper ───────────────────────────────────────────────
function copyCode(layout: Layout) {
  const code = `// Paste these values into pdfTemplate.ts → LAYOUT
customerInfo: {
  fontSize:      ${layout.customerInfo.fontSize},
  rowGap:        ${layout.customerInfo.rowGap},
  colLabel:     ${layout.customerInfo.colLabel},
  colColon:     ${layout.customerInfo.colColon},
  colRightLabel:${layout.customerInfo.colRightLabel},
  colRightValue:${layout.customerInfo.colRightValue},
},
table: {
  colNo:    ${layout.table.colNo},
  colCode: ${layout.table.colCode},
  colDesc: ${layout.table.colDesc},
  colQty:   ${layout.table.colQty},
  colPrice:${layout.table.colPrice},
  colTotal:${layout.table.colTotal},
},
margins: {
  top:    ${layout.margins.top},
  right:  ${layout.margins.right},
  bottom: ${layout.margins.bottom},
  left:   ${layout.margins.left},
},`;
  navigator.clipboard.writeText(code);
}

// ── Resizable column handle ────────────────────────────────────────────────
function ResizeHandle({ onDrag }: { onDrag: (delta: number) => void }) {
  const dragging = useRef(false);
  const startX = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    e.preventDefault();

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientX - startX.current;
      startX.current = ev.clientX;
      onDrag(delta);
    };
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 bg-transparent z-10 group"
      title="Drag to resize"
    >
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-gray-400 group-hover:bg-blue-500 rounded" />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function PdfLayoutEditorPage() {
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'table' | 'page'>('info');

  const set = useCallback(<K extends keyof Layout>(section: K, key: keyof Layout[K], value: number) => {
    setLayout(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  }, []);

  const handleCopy = () => {
    copyCode(layout);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => setLayout(DEFAULT_LAYOUT);

  const ci = layout.customerInfo;
  const tb = layout.table;
  const mg = layout.margins;

  // Preview scale — fit A4 (794px) into ~560px preview
  const PREVIEW_W = 560;
  const scale = PREVIEW_W / 794;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      {/* ── Left panel: controls ── */}
      <div className="w-80 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h1 className="text-sm font-bold text-gray-800">PDF Layout Editor</h1>
          <p className="text-xs text-gray-500 mt-0.5">Adjust values and see live preview</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 text-xs font-medium">
          {(['info', 'table', 'page'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 capitalize transition-colors ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab === 'info' ? 'Info Grid' : tab === 'table' ? 'Item Table' : 'Page'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">

          {activeTab === 'info' && (
            <>
              <SectionHeader>Column Widths</SectionHeader>
              <SliderRow label="Left Label" value={ci.colLabel} min={60} max={160} onChange={v => set('customerInfo', 'colLabel', v)} />
              <SliderRow label="Colon" value={ci.colColon} min={8} max={24} onChange={v => set('customerInfo', 'colColon', v)} />
              <SliderRow label="Right Label" value={ci.colRightLabel} min={60} max={180} onChange={v => set('customerInfo', 'colRightLabel', v)} />
              <SliderRow label="Right Value" value={ci.colRightValue} min={60} max={200} onChange={v => set('customerInfo', 'colRightValue', v)} />
              <SectionHeader>Spacing</SectionHeader>
              <SliderRow label="Row Gap" value={ci.rowGap} min={2} max={20} onChange={v => set('customerInfo', 'rowGap', v)} />
              <SectionHeader>Font</SectionHeader>
              <SliderRow label="Font Size" value={ci.fontSize} min={7} max={14} onChange={v => set('customerInfo', 'fontSize', v)} unit="pt" />
            </>
          )}

          {activeTab === 'table' && (
            <>
              <SectionHeader>Column Widths (%)</SectionHeader>
              <div className="text-xs text-gray-400 mb-2">Total must = 100%. Description auto-adjusts.</div>
              <SliderRow label="No." value={tb.colNo} min={3} max={12} onChange={v => set('table', 'colNo', v)} unit="%" />
              <SliderRow label="Item Code" value={tb.colCode} min={8} max={25} onChange={v => set('table', 'colCode', v)} unit="%" />
              <SliderRow label="Qty" value={tb.colQty} min={3} max={12} onChange={v => set('table', 'colQty', v)} unit="%" />
              <SliderRow label="Unit Price" value={tb.colPrice} min={6} max={20} onChange={v => set('table', 'colPrice', v)} unit="%" />
              <SliderRow label="Total" value={tb.colTotal} min={6} max={20} onChange={v => set('table', 'colTotal', v)} unit="%" />
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                <span className="text-gray-500">Description: </span>
                <span className={`font-mono font-bold ${100 - tb.colNo - tb.colCode - tb.colQty - tb.colPrice - tb.colTotal < 20 ? 'text-red-500' : 'text-blue-600'}`}>
                  {100 - tb.colNo - tb.colCode - tb.colQty - tb.colPrice - tb.colTotal}%
                </span>
                {100 - tb.colNo - tb.colCode - tb.colQty - tb.colPrice - tb.colTotal < 20 && (
                  <span className="text-red-400 ml-1">(too narrow!)</span>
                )}
              </div>
            </>
          )}

          {activeTab === 'page' && (
            <>
              <SectionHeader>Margins (mm)</SectionHeader>
              <SliderRow label="Top" value={mg.top} min={5} max={30} onChange={v => set('margins', 'top', v)} unit="mm" />
              <SliderRow label="Right" value={mg.right} min={5} max={30} onChange={v => set('margins', 'right', v)} unit="mm" />
              <SliderRow label="Bottom" value={mg.bottom} min={5} max={30} onChange={v => set('margins', 'bottom', v)} unit="mm" />
              <SliderRow label="Left" value={mg.left} min={5} max={30} onChange={v => set('margins', 'left', v)} unit="mm" />
              <SectionHeader>Title</SectionHeader>
              <SliderRow label="Font Size" value={layout.title.fontSize} min={10} max={28} onChange={v => set('title', 'fontSize', v)} unit="pt" />
              <SliderRow label="Margin Top" value={layout.title.marginTop} min={1} max={15} onChange={v => set('title', 'marginTop', v)} unit="mm" />
              <SliderRow label="Margin Bottom" value={layout.title.marginBottom} min={1} max={15} onChange={v => set('title', 'marginBottom', v)} unit="mm" />
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-4 py-3 border-t border-gray-200 flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            {copied ? '✓ Copied!' : '📋 Copy Config'}
          </button>
          <button
            onClick={handleReset}
            className="py-2 px-3 text-xs font-semibold rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Right panel: live preview ── */}
      <div className="flex-1 overflow-auto bg-gray-300 flex items-start justify-center p-8">
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: 794, minHeight: 500 }}>

          {/* A4 page preview */}
          <div style={{
            width: 794,
            background: 'white',
            padding: `${mg.top * 3.78}px ${mg.right * 3.78}px ${mg.bottom * 3.78}px ${mg.left * 3.78}px`,
            boxSizing: 'border-box',
            fontFamily: "'Times New Roman', serif",
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #000', paddingBottom: 10, marginBottom: 10, gap: 14 }}>
              <img src="https://i.postimg.cc/RFYdrpBC/Limperial-Technology-Logo01-png(004aad).png" alt="Logo" style={{ width: 60, height: 24, objectFit: 'contain' }} />
              <div style={{ fontSize: 8, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 'bold', color: '#004aad', fontSize: 12 }}>LIMPERIAL TECHNOLOGY CO., LTD.</div>
                <div>Tel : (+855) 92 218 333 || Email : info@limperialtech.com || Website : www.limperialtech.com</div>
                <div>Address : Building #15, Street Ayeaksmaiyean Bo (139), Sangkat Srah Chak, Khan Daun Penh, Phnom Penh.</div>
              </div>
            </div>

            {/* Title */}
            <h1 style={{
              textAlign: 'center',
              fontSize: layout.title.fontSize,
              fontWeight: 'bold',
              textDecoration: 'underline',
              margin: `${layout.title.marginTop * 3.78}px 0 ${layout.title.marginBottom * 3.78}px`,
            }}>QUOTATION</h1>

            {/* Info grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `${ci.colLabel}px ${ci.colColon}px 1fr ${ci.colRightLabel}px ${ci.colColon}px ${ci.colRightValue}px`,
              gap: `${ci.rowGap}px 0`,
              fontSize: ci.fontSize,
              marginBottom: 16,
            }}>
              {[
                ['Company Name', SAMPLE.companyName, 'Quotation No', SAMPLE.quotationNo],
                ['Address', SAMPLE.address, 'Quote Date', SAMPLE.quoteDate],
                ['Contact Person', SAMPLE.contactPerson, 'Validity', SAMPLE.validity],
                ['Tel', SAMPLE.tel, 'Status', SAMPLE.status],
                ['Email', SAMPLE.email, 'Payment Term', SAMPLE.paymentTerm],
              ].map(([l1, v1, l2, v2], i) => (
                <React.Fragment key={i}>
                  <div style={{ whiteSpace: 'nowrap', alignSelf: 'start' }}>{l1}</div>
                  <div style={{ textAlign: 'center', alignSelf: 'start' }}>:</div>
                  <div style={{ whiteSpace: 'pre-line', lineHeight: 1.5, paddingRight: 20, alignSelf: 'start' }}>{v1}</div>
                  <div style={{ whiteSpace: 'nowrap', paddingLeft: 8, alignSelf: 'start' }}>{l2}</div>
                  <div style={{ textAlign: 'center', alignSelf: 'start' }}>:</div>
                  <div style={{ alignSelf: 'start' }}>{v2}</div>
                </React.Fragment>
              ))}
            </div>

            {/* Item table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {[
                    ['No.', tb.colNo],
                    ['Item Code', tb.colCode],
                    ['Description', 100 - tb.colNo - tb.colCode - tb.colQty - tb.colPrice - tb.colTotal],
                    ['Qty', tb.colQty],
                    ['Unit Price', tb.colPrice],
                    ['Total', tb.colTotal],
                  ].map(([label, w]) => (
                    <th key={label as string} style={{ width: `${w}%`, background: '#004aad', color: '#fff', padding: '5px 6px', textAlign: 'center', border: '1px solid #004aad', fontSize: 9 }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SAMPLE_ITEMS.map(item => (
                  <React.Fragment key={item.no}>
                    <tr>
                      <td style={{ padding: '5px 6px', border: '1px solid #000', textAlign: 'center' }}>{item.no}</td>
                      <td style={{ padding: '5px 6px', border: '1px solid #000', wordBreak: 'break-word' }}>{item.code}</td>
                      <td style={{ padding: '5px 6px', border: '1px solid #000', fontWeight: 'bold' }}>{item.model}</td>
                      <td style={{ padding: '5px 6px', border: '1px solid #000', textAlign: 'center' }}>{item.qty}</td>
                      <td style={{ padding: '5px 6px', border: '1px solid #000', textAlign: 'right' }}>$ {item.price.toFixed(2)}</td>
                      <td style={{ padding: '5px 6px', border: '1px solid #000', textAlign: 'right' }}>$ {item.amount.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td></td><td></td>
                      <td style={{ padding: '3px 6px', border: '1px solid #000', borderTop: 'none', fontSize: 8, color: '#333' }}>{item.desc}</td>
                      <td></td><td></td><td></td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ padding: '4px 8px', border: '1px solid #000', textAlign: 'right' }}>Sub Total (USD)</td>
                  <td style={{ padding: '4px 8px', border: '1px solid #000', textAlign: 'right' }}>$ 7,610.00</td>
                </tr>
                <tr style={{ background: '#f0f0f0' }}>
                  <td colSpan={5} style={{ padding: '4px 8px', border: '1px solid #000', borderTop: '2px solid #000', textAlign: 'right', fontWeight: 'bold' }}>Grand Total (USD)</td>
                  <td style={{ padding: '4px 8px', border: '1px solid #000', borderTop: '2px solid #000', textAlign: 'right', fontWeight: 'bold' }}>$ 7,610.00</td>
                </tr>
              </tfoot>
            </table>

          </div>
        </div>
      </div>

    </div>
  );
}
