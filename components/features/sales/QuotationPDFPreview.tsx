import React, { useState, useEffect, useRef, useMemo } from 'react';
import { buildPreviewHtml } from '../../../lib/buildPreviewHtml';
import { useToast } from '../../../contexts/ToastContext';
import { SlidersHorizontal, ChevronUp, ChevronDown } from 'lucide-react';

interface QuotationPDFPreviewProps {
    quoteNo: string;
    companyName: string;
    printableProps: {
        headerData: Record<string, any>;
        items: Array<{
            no: number;
            itemCode: string;
            modelName?: string;
            description?: string;
            qty: number | string;
            unitPrice: number | string;
            commission?: number | string;
            amount: number;
        }>;
        totals: { subTotal: number; vat: number; grandTotal: number };
        currency: 'USD' | 'KHR';
    };
    columnWidths?: number[];
}

const QuotationPDFPreview: React.FC<QuotationPDFPreviewProps> = ({
    quoteNo,
    companyName,
    printableProps,
    columnWidths,
}) => {
    const [showControls, setShowControls] = useState(false);
    const [labelPadding, setLabelPadding] = useState(200);
    const [linePadding, setLinePadding]   = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const { addToast } = useToast();

    const previewHtml = useMemo(() => {
        try {
            return buildPreviewHtml({
                type: 'Quotation',
                headerData: printableProps.headerData,
                items: printableProps.items.filter(i => i.no > 0),
                totals: { subTotal: printableProps.totals.subTotal, vat: printableProps.totals.vat, grandTotal: printableProps.totals.grandTotal },
                currency: printableProps.currency,
                signaturePadding: linePadding,
                labelPadding,
                columnWidths,
            });
        } catch (err: any) {
            addToast(`Preview error: ${err.message}`, 'error');
            return null;
        }
    }, [printableProps, linePadding, labelPadding, columnWidths]);

    useEffect(() => {
        const doc = iframeRef.current?.contentDocument as any;
        if (!doc || !previewHtml) return;
        doc.open();
        doc.write(previewHtml);
        doc.close();
    }, [previewHtml]);

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

    return (
        <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-brand-500 rounded-full"></div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-800">PDF Layout Preview</h3>
                        <p className="text-[10px] text-gray-500">
                            {quoteNo} • {companyName || 'No Company'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Signature spacing toggle */}
                    <button
                        onClick={() => setShowControls(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            showControls
                                ? 'bg-brand-500/10 text-brand-600 border-brand-500/30'
                                : 'bg-white text-muted-foreground border-gray-200 hover:border-brand-500/30 hover:text-brand-600'
                        }`}
                        title="Adjust signature spacing"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        Signature Spacing
                    </button>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs text-slate-500 font-medium">Live Preview</span>
                    </div>
                </div>
            </div>

            {/* Signature spacing controls panel */}
            {showControls && (
                <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-8">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <SlidersHorizontal className="w-4 h-4 text-brand-500" />
                        <span className="text-xs font-bold text-foreground">Signature Block Spacing</span>
                    </div>
                    <Stepper
                        label='"Prepared By" → Line gap'
                        value={labelPadding}
                        onChange={setLabelPadding}
                        min={-200} max={300} step={10}
                    />
                    <Stepper
                        label='Items table → Sig block gap'
                        value={linePadding}
                        onChange={setLinePadding}
                        min={-200} max={300} step={10}
                    />
                    <button
                        onClick={() => { setLabelPadding(200); setLinePadding(0); }}
                        className="text-xs text-muted-foreground hover:text-brand-500 underline underline-offset-2 transition-colors"
                    >Reset</button>
                </div>
            )}

            {/* iframe — content written via ref, no srcDoc reload */}
            <div className="flex-1 overflow-hidden">
                <iframe
                    ref={iframeRef}
                    className={`w-full h-full border-0 ${previewHtml ? '' : 'hidden'}`}
                    title="Quotation PDF Preview"
                />
                {!previewHtml && (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                        Fill in quotation details to see preview
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuotationPDFPreview;
