import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Invoice } from '../../../../types';
import { LineItem } from './types';
import { generatePDF } from '../../../../lib/pdfClient';
import { buildPreviewHtml } from '../../../../lib/buildPreviewHtml';
import { useToast } from '../../../../contexts/ToastContext';
import { isServiceInvoice } from '../../../../utils/serviceInvoice';
import { SlidersHorizontal, ChevronUp, ChevronDown, Languages } from 'lucide-react';

interface InvoicePreviewProps {
    previewMode: 'invoice';
    invoice: Partial<Invoice>;
    items: LineItem[];
    printableProps: any;
    signaturePadding: number;
    onSignaturePaddingChange: (v: number) => void;
    labelPadding: number;
    onLabelPaddingChange: (v: number) => void;
    hideKhmer: boolean;
    onHideKhmerChange: (v: boolean) => void;
    columnWidths?: number[];
}

const Stepper = ({ label, value, onChange, min = -200, max = 300, step = 10 }: {
    label: string; value: number; onChange: (v: number) => void;
    min?: number; max?: number; step?: number;
}) => (
    <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
            <button
                onClick={() => onChange(Math.max(min, value - step))}
                className="w-7 h-7 rounded-md bg-muted hover:bg-muted/80 border border-border flex items-center justify-center transition-all active:scale-90"
            ><ChevronDown className="w-3.5 h-3.5" /></button>
            <div className="flex flex-col items-center gap-0.5">
                <input
                    type="range" min={min} max={max} step={step} value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    className="w-24 accent-brand-500"
                />
                <span className="text-xs font-mono font-bold text-foreground">{value}px</span>
            </div>
            <button
                onClick={() => onChange(Math.min(max, value + step))}
                className="w-7 h-7 rounded-md bg-muted hover:bg-muted/80 border border-border flex items-center justify-center transition-all active:scale-90"
            ><ChevronUp className="w-3.5 h-3.5" /></button>
        </div>
    </div>
);

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({ invoice, items, printableProps, signaturePadding, onSignaturePaddingChange, labelPadding, onLabelPaddingChange, hideKhmer, onHideKhmerChange, columnWidths }) => {
    const [apiUrl, setApiUrl]   = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const iframeRef   = useRef<HTMLIFrameElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevUrlRef  = useRef<string | null>(null);
    const { addToast } = useToast();

    const taxable = invoice['Taxable'] || 'NON-VAT';
    const pdfType: 'Tax Invoice' | 'Invoice' | 'Commercial Invoice' | 'Service Invoice' =
        isServiceInvoice(invoice) ? 'Service Invoice' :
        taxable === 'VAT' ? 'Tax Invoice' :
        taxable === 'Commercial Invoice' ? 'Commercial Invoice' : 'Invoice';

    const baseOpts = useMemo(() => ({
        type: pdfType,
        headerData: printableProps.headerData,
        items: items.filter(i => i.no > 0 || i.isPromotion).map(i => ({
            no: i.no, itemCode: i.itemCode, modelName: i.modelName,
            description: i.description, qty: i.qty, unitPrice: i.unitPrice, amount: i.amount,
            isPromotion: i.isPromotion,
            isPCBuild: i.isPCBuild, buildComponents: i.buildComponents,
        })),
        totals: printableProps.totals,
        currency: printableProps.currency,
        signaturePadding,
        labelPadding,
        hideKhmer,
        columnWidths,
    }), [pdfType, printableProps, items, signaturePadding, labelPadding, hideKhmer, columnWidths]);

    // Client-side build — synchronous, no API (Commercial Invoice)
    const clientHtml = useMemo(() => {
        try { return buildPreviewHtml(baseOpts as any); } catch { return null; }
    }, [baseOpts]);

    // Write directly into iframe — no reload, no flash
    useEffect(() => {
        const doc = iframeRef.current?.contentDocument as any;
        if (!doc || !clientHtml) return;
        doc.open();
        doc.write(clientHtml);
        doc.close();
    }, [clientHtml]);

    // API fallback for Tax Invoice / Invoice (embedded fonts)
    useEffect(() => {
        if (clientHtml !== null) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const url = await generatePDF({ ...baseOpts, previewMode: true } as any) as string;
                if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
                prevUrlRef.current = url;
                setApiUrl(url);
            } catch (err: any) {
                addToast(`Preview error: ${err.message}`, 'error');
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [baseOpts, clientHtml]);

    return (
        <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-brand-500 rounded-full"></div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-800">Invoice Preview</h3>
                        <p className="text-[10px] text-gray-500">{invoice['Inv No']} • {invoice['Company Name'] || 'No Company Selected'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {pdfType === 'Invoice' && (
                        <button
                            onClick={() => onHideKhmerChange(!hideKhmer)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                hideKhmer
                                    ? 'bg-brand-500/10 text-brand-600 border-brand-500/30'
                                    : 'bg-white text-muted-foreground border-gray-200 hover:border-brand-500/30 hover:text-brand-600'
                            }`}
                            title="Omit Khmer text — English-only invoice"
                        >
                            <Languages className="w-3.5 h-3.5" />
                            English Only
                        </button>
                    )}
                    <button
                        onClick={() => setShowControls(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            showControls
                                ? 'bg-brand-500/10 text-brand-600 border-brand-500/30'
                                : 'bg-white text-muted-foreground border-gray-200 hover:border-brand-500/30 hover:text-brand-600'
                        }`}
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        Signature Spacing
                    </button>
                    {loading
                        ? <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /><span className="text-xs text-slate-400 font-medium">Updating…</span></div>
                        : <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-xs text-slate-500 font-medium">Live Preview</span></div>
                    }

                </div>
            </div>

            {showControls && (
                <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-8">
                    <div className="flex items-center gap-1.5">
                        <SlidersHorizontal className="w-4 h-4 text-brand-500" />
                        <span className="text-xs font-bold text-foreground">Signature Block Spacing</span>
                    </div>
                    <Stepper
                        label='"Prepared By" → Line gap'
                        value={labelPadding}
                        onChange={onLabelPaddingChange}
                        min={-200} max={300} step={10}
                    />
                    <Stepper
                        label="Items table → Sig block gap"
                        value={signaturePadding}
                        onChange={onSignaturePaddingChange}
                        min={-200} max={300} step={10}
                    />
                    <button
                        onClick={() => { onSignaturePaddingChange(0); onLabelPaddingChange(200); }}
                        className="text-xs text-muted-foreground hover:text-brand-500 underline underline-offset-2 transition-colors"
                    >Reset</button>
                </div>
            )}

            <div className="flex-1 overflow-hidden">
                <iframe
                    ref={iframeRef}
                    src={clientHtml ? undefined : apiUrl ?? undefined}
                    className={`w-full h-full border-0 ${clientHtml || apiUrl ? '' : 'hidden'}`}
                    title="Invoice PDF Preview"
                />
                {!clientHtml && !apiUrl && (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                        {loading ? 'Generating preview...' : 'Fill in invoice details to see preview'}
                    </div>
                )}
            </div>
        </div>
    );
};
