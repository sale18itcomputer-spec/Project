'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { generatePDF, PdfClientOptions } from '../../lib/pdfClient';
import { buildPreviewHtml } from '../../lib/buildPreviewHtml';
import { SlidersHorizontal, ChevronUp, ChevronDown } from 'lucide-react';

interface PdfPreviewPaneProps {
    pdfOptions: Omit<PdfClientOptions, 'previewMode' | 'filename' | 'signaturePadding' | 'labelPadding'>;
    docLabel: string;
    debounceMs?: number;
    signaturePadding: number;
    onSignaturePaddingChange: (v: number) => void;
    defaultSignaturePadding?: number;
    labelPadding?: number;
    onLabelPaddingChange?: (v: number) => void;
    defaultLabelPadding?: number;
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

const PdfPreviewPane: React.FC<PdfPreviewPaneProps> = ({
    pdfOptions,
    docLabel,
    debounceMs = 800,
    signaturePadding,
    onSignaturePaddingChange,
    defaultSignaturePadding = 0,
    labelPadding = 200,
    onLabelPaddingChange,
    defaultLabelPadding = 200,
    columnWidths,
}) => {
    const [apiUrl, setApiUrl]         = useState<string | null>(null);
    const [loading, setLoading]       = useState(false);
    const [showControls, setShowControls] = useState(false);
    const iframeRef  = useRef<HTMLIFrameElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevUrlRef  = useRef<string | null>(null);

    // Synchronous client-side build — no API, no debounce needed
    const clientHtml = useMemo(() => {
        try { return buildPreviewHtml({ ...pdfOptions, signaturePadding, labelPadding, columnWidths } as any); }
        catch { return null; }
     
    }, [JSON.stringify(pdfOptions), signaturePadding, labelPadding, columnWidths]);

    // Write directly into iframe document — no reload, no flash
    useEffect(() => {
        const doc = iframeRef.current?.contentDocument as any;
        if (!doc || !clientHtml) return;
        doc.open();
        doc.write(clientHtml);
        doc.close();
    }, [clientHtml]);

    // API fallback for server-only types (Tax Invoice, Invoice, etc.)
    useEffect(() => {
        if (clientHtml !== null) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const url = await generatePDF({ ...pdfOptions, signaturePadding, labelPadding, columnWidths, previewMode: true } as any) as string;
                if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
                prevUrlRef.current = url;
                setApiUrl(url);
            } catch {
                // silently fail — download still works
            } finally {
                setLoading(false);
            }
        }, debounceMs);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
     
    }, [JSON.stringify(pdfOptions), signaturePadding, labelPadding, columnWidths]);

    const handleReset = () => {
        onSignaturePaddingChange(defaultSignaturePadding);
        onLabelPaddingChange?.(defaultLabelPadding);
    };

    return (
        <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">

            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-brand-500 rounded-full" />
                    <div>
                        <h3 className="text-sm font-bold text-gray-800">PDF Layout Preview</h3>
                        <p className="text-[10px] text-gray-500">{docLabel}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
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
                    {loading && clientHtml === null ? (
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-xs text-slate-400 font-medium">Updating…</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs text-slate-500 font-medium">Live Preview</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Collapsible spacing controls */}
            {showControls && (
                <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-8">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <SlidersHorizontal className="w-4 h-4 text-brand-500" />
                        <span className="text-xs font-bold text-foreground">Signature Block Spacing</span>
                    </div>
                    {onLabelPaddingChange && (
                        <Stepper
                            label='"Prepared By" → Line gap'
                            value={labelPadding}
                            onChange={onLabelPaddingChange}
                            min={-200} max={300} step={10}
                        />
                    )}
                    <Stepper
                        label="Items table → Sig block gap"
                        value={signaturePadding}
                        onChange={onSignaturePaddingChange}
                        min={-200} max={300} step={10}
                    />
                    <button
                        onClick={handleReset}
                        className="text-xs text-muted-foreground hover:text-brand-500 underline underline-offset-2 transition-colors"
                    >Reset</button>
                </div>
            )}

            {/* iframe — content written via ref for client types, src for API fallback */}
            <div className="flex-1 overflow-hidden">
                <iframe
                    ref={iframeRef}
                    src={clientHtml ? undefined : apiUrl ?? undefined}
                    className={`w-full h-full border-0 ${clientHtml || apiUrl ? '' : 'hidden'}`}
                    title="PDF Preview"
                />
                {!clientHtml && !apiUrl && (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                        {loading ? 'Generating preview…' : 'Fill in details to see preview'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PdfPreviewPane;
