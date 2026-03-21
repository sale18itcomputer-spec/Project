'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    X, SlidersHorizontal, Layout, Type, Image as ImageIcon,
    Ruler, ScrollText, RotateCcw, Download,
    ChevronRight, Eye, Settings2, Maximize2, Minimize2
} from 'lucide-react';
import PDFControlField from "../pdf/PDFControlField";
import { PDFLayoutConfig, defaultLayoutConfig } from "../pdf/pdfGenerator";
import { generatePDF } from "@/lib/pdfClient";

interface PDFConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (layout: PDFLayoutConfig) => void;
    currentLayout?: PDFLayoutConfig;
}

const MM_TO_PX = 3;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

type TabKey = 'header' | 'table' | 'info' | 'footer';

const TABS: { key: TabKey; label: string; icon: React.ReactNode; color: string; activeColor: string; borderColor: string; bgColor: string }[] = [
    { key: 'header', label: 'Header', icon: <ImageIcon className="w-3.5 h-3.5" />, color: 'text-blue-500', activeColor: 'text-blue-600', borderColor: 'border-blue-500', bgColor: 'bg-blue-50' },
    { key: 'info',   label: 'Info',   icon: <Type className="w-3.5 h-3.5" />,     color: 'text-amber-500', activeColor: 'text-amber-600', borderColor: 'border-amber-500', bgColor: 'bg-amber-50' },
    { key: 'table',  label: 'Table',  icon: <Ruler className="w-3.5 h-3.5" />,    color: 'text-emerald-500', activeColor: 'text-emerald-600', borderColor: 'border-emerald-500', bgColor: 'bg-emerald-50' },
    { key: 'footer', label: 'Footer', icon: <ScrollText className="w-3.5 h-3.5" />, color: 'text-purple-500', activeColor: 'text-purple-600', borderColor: 'border-purple-500', bgColor: 'bg-purple-50' },
];

const PDFConfigModal: React.FC<PDFConfigModalProps> = ({ isOpen, onClose, onGenerate, currentLayout }) => {
    const [layout, setLayout] = useState<PDFLayoutConfig>(currentLayout || defaultLayoutConfig);
    const [activeTab, setActiveTab] = useState<TabKey>('header');
    const [hoveredPath, setHoveredPath] = useState<string | null>(null);
    const [previewScale, setPreviewScale] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showPreview, setShowPreview] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
                const pad = 48;
                const availW = containerRef.current.offsetWidth - pad;
                const availH = containerRef.current.offsetHeight - pad;
                const scaleX = availW / (A4_WIDTH_MM * MM_TO_PX);
                const scaleY = availH / (A4_HEIGHT_MM * MM_TO_PX);
                setPreviewScale(Math.min(scaleX, scaleY, 1));
            }
        };
        if (isOpen) {
            setLayout(currentLayout || defaultLayoutConfig);
            setTimeout(updateScale, 100);
        }
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, [isOpen, currentLayout, isFullscreen, showPreview]);

    const updateLayout = (path: string, value: number) => {
        const keys = path.split('.');
        setLayout(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            let cur: any = next;
            for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
            cur[keys[keys.length - 1]] = Number(value);
            return next;
        });
    };

    const resetToDefault = () => setLayout(defaultLayoutConfig);

    // eslint-disable-next-line unused-imports/no-unused-vars
    const handleGenerate = async () => {
        await generatePDF({
            type: 'Quotation',
            headerData: {
                'Company Name': 'LIMPERIAL TECHNOLOGY CO., LTD',
                'Company Address': 'Building #15, Phnom Penh, Cambodia',
                'Contact Person': 'Client Sample',
                'Contact Tel': '012 345 678',
                'Contact Email': 'client@example.com',
                'Quotation ID': 'QT-PREVIEW',
                'Quote Date': new Date().toISOString(),
                'Validity Date': new Date(Date.now() + 7 * 86400000).toISOString(),
                'Payment Term': 'COD',
            },
            items: [{ no: 1, itemCode: 'ITEM-001', modelName: 'MODEL-NAME-X100', description: 'Sample spec line', qty: 1, unitPrice: 100, amount: 100 }],
            totals: { subTotal: 100, tax: 10, grandTotal: 110 },
            currency: 'USD',
            previewMode: false,
            filename: 'Preview.pdf'
        });
    };

    if (!isOpen) return null;

    const tableContentWidth = A4_WIDTH_MM - layout.table.margins.left - layout.table.margins.right;

    const LiveElement = ({ x, y, width, height, children, fontSize, path, bold = false, align = 'left' }: {
        x: number; y: number; width?: number; height?: number;
        children: React.ReactNode; fontSize?: number; path?: string;
        bold?: boolean; align?: 'left' | 'center' | 'right';
    }) => {
        const isHovered = path && hoveredPath && (hoveredPath === path || path.startsWith(hoveredPath) || hoveredPath.startsWith(path));
        return (
            <div
                className={`absolute transition-all duration-200 font-serif ${isHovered ? 'bg-blue-50/80 ring-1 ring-blue-400 z-10 shadow-sm' : ''} ${bold ? 'font-bold' : 'font-normal'}`}
                style={{
                    left: `${x * MM_TO_PX}px`, top: `${y * MM_TO_PX}px`,
                    width: width ? `${width * MM_TO_PX}px` : 'auto',
                    height: height ? `${height * MM_TO_PX}px` : 'auto',
                    fontSize: fontSize ? `${fontSize * (MM_TO_PX / 3.5)}px` : '10px',
                    textAlign: align,
                    display: 'flex', alignItems: 'center',
                    justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
                    padding: '1px', lineHeight: '1.2'
                }}
                onMouseEnter={() => path && setHoveredPath(path)}
                onMouseLeave={() => setHoveredPath(null)}
            >
                {children}
            </div>
        );
    };

    const SectionCard = ({ title, icon, onReset, color = 'blue', children }: {
        title: string; icon: React.ReactNode; onReset?: () => void; color?: string; children: React.ReactNode;
    }) => (
        <div className="rounded-xl border border-border/60 overflow-hidden bg-card shadow-sm hover:shadow-md transition-shadow">
            <div className={`flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border/40`}>
                <div className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-${color}-600`}>
                    {icon} {title}
                </div>
                {onReset && (
                    <button onClick={onReset} className="text-[10px] font-semibold text-muted-foreground/60 hover:text-foreground flex items-center gap-1 group transition-colors px-2 py-1 rounded-md hover:bg-muted">
                        <RotateCcw className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform duration-300" /> Reset
                    </button>
                )}
            </div>
            <div className="divide-y divide-border/30">
                {children}
            </div>
        </div>
    );

    const activeTabMeta = TABS.find(t => t.key === activeTab)!;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`bg-background rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 border border-border/50 ${isFullscreen ? 'w-full h-full rounded-none' : 'w-[96vw] max-w-7xl h-[92vh]'}`}>

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-card shrink-0">
                    <div className="flex items-center gap-3.5">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/25">
                            <SlidersHorizontal className="w-4.5 h-4.5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-foreground tracking-tight">PDF Layout Configuration</h2>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Drag sliders to adjust positioning and sizing in real-time</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                        >
                            <Eye className="w-3.5 h-3.5" /> {showPreview ? 'Hide' : 'Show'} Preview
                        </button>
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="flex flex-1 overflow-hidden">

                    {/* ── Left Panel: Controls ── */}
                    <div className="w-72 shrink-0 border-r border-border/60 flex flex-col bg-muted/20">

                        {/* Tab bar */}
                        <div className="flex border-b border-border/60 bg-card shrink-0">
                            {TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === tab.key
                                        ? `${tab.activeColor} ${tab.borderColor} ${tab.bgColor}`
                                        : 'text-muted-foreground/50 border-transparent hover:text-muted-foreground hover:bg-muted/50'
                                    }`}
                                >
                                    <span className={activeTab === tab.key ? tab.activeColor : ''}>{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab indicator breadcrumb */}
                        <div className={`flex items-center gap-2 px-4 py-2 text-[10px] font-semibold ${activeTabMeta.bgColor} border-b border-border/40 shrink-0`}>
                            <Settings2 className={`w-3 h-3 ${activeTabMeta.activeColor}`} />
                            <span className={activeTabMeta.activeColor}>{activeTabMeta.label} Settings</span>
                            <ChevronRight className="w-3 h-3 text-muted-foreground/40 ml-auto" />
                        </div>

                        {/* Controls */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">

                            {activeTab === 'header' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <SectionCard title="Logo" icon={<ImageIcon className="w-3.5 h-3.5" />} color="blue"
                                        onReset={() => { updateLayout('header.logo.x', defaultLayoutConfig.header.logo.x); updateLayout('header.logo.y', defaultLayoutConfig.header.logo.y); updateLayout('header.logo.width', defaultLayoutConfig.header.logo.width); }}>
                                        <PDFControlField label="X Position" path="header.logo.x" min={0} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                        <PDFControlField label="Y Position" path="header.logo.y" min={0} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                        <PDFControlField label="Width" path="header.logo.width" min={10} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                    </SectionCard>
                                    <SectionCard title="Company Info" icon={<Type className="w-3.5 h-3.5" />} color="blue"
                                        onReset={() => { updateLayout('header.companyName.x', defaultLayoutConfig.header.companyName.x); updateLayout('header.companyName.y', defaultLayoutConfig.header.companyName.y); updateLayout('header.companyName.fontSize', defaultLayoutConfig.header.companyName.fontSize); }}>
                                        <PDFControlField label="X Position" path="header.companyName.x" min={0} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                        <PDFControlField label="Y Position" path="header.companyName.y" min={0} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                        <PDFControlField label="Name Font" path="header.companyName.fontSize" min={8} max={24} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                        <PDFControlField label="Contact Font" path="header.contactInfo.fontSize" min={6} max={14} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                        <PDFControlField label="Address Font" path="header.address.fontSize" min={6} max={14} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                    </SectionCard>
                                    <SectionCard title="Separator Line" icon={<Ruler className="w-3.5 h-3.5" />} color="blue"
                                        onReset={() => updateLayout('header.separatorLine.y', defaultLayoutConfig.header.separatorLine.y)}>
                                        <PDFControlField label="Y Position" path="header.separatorLine.y" min={10} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                    </SectionCard>
                                </div>
                            )}

                            {activeTab === 'info' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <SectionCard title="Info Block" icon={<ScrollText className="w-3.5 h-3.5" />} color="amber"
                                        onReset={() => { updateLayout('info.startY', defaultLayoutConfig.info.startY); updateLayout('info.fontSize', defaultLayoutConfig.info.fontSize); updateLayout('info.rowHeight', defaultLayoutConfig.info.rowHeight); }}>
                                        <PDFControlField label="Start Y" path="info.startY" min={30} max={150} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                        <PDFControlField label="Font Size" path="info.fontSize" min={6} max={14} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                        <PDFControlField label="Row Height" path="info.rowHeight" min={4} max={15} step={0.1} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                    </SectionCard>
                                    <SectionCard title="Left Column" icon={<Layout className="w-3.5 h-3.5" />} color="amber">
                                        <PDFControlField label="Label X" path="info.col1.labelX" min={5} max={80} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                        <PDFControlField label="Label Width" path="info.col1.labelWidth" min={10} max={60} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                        <PDFControlField label="Colon Gap" path="info.col1.gap" min={0} max={20} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                    </SectionCard>
                                    <SectionCard title="Right Column" icon={<Layout className="w-3.5 h-3.5" />} color="amber">
                                        <PDFControlField label="Label X" path="info.col2.labelX" min={100} max={180} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                        <PDFControlField label="Label Width" path="info.col2.labelWidth" min={10} max={60} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                        <PDFControlField label="Colon Gap" path="info.col2.gap" min={0} max={20} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                    </SectionCard>
                                </div>
                            )}

                            {activeTab === 'table' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <SectionCard title="Table" icon={<Layout className="w-3.5 h-3.5" />} color="emerald"
                                        onReset={() => { updateLayout('table.startY', defaultLayoutConfig.table.startY); updateLayout('table.fontSize', defaultLayoutConfig.table.fontSize); updateLayout('table.descriptionFontSize', defaultLayoutConfig.table.descriptionFontSize); }}>
                                        <PDFControlField label="Start Y" path="table.startY" min={60} max={250} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                        <PDFControlField label="Header Font" path="table.fontSize" min={6} max={14} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                        <PDFControlField label="Content Font" path="table.descriptionFontSize" min={6} max={12} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                    </SectionCard>
                                    <SectionCard title="Margins" icon={<Ruler className="w-3.5 h-3.5" />} color="emerald"
                                        onReset={() => { updateLayout('table.margins.left', defaultLayoutConfig.table.margins.left); updateLayout('table.margins.right', defaultLayoutConfig.table.margins.right); }}>
                                        <PDFControlField label="Left" path="table.margins.left" min={5} max={40} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                        <PDFControlField label="Right" path="table.margins.right" min={5} max={40} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                    </SectionCard>
                                    <SectionCard title="Column Widths" icon={<Layout className="w-3.5 h-3.5" />} color="emerald"
                                        onReset={() => { ['no','itemCode','qty','unitPrice','total'].forEach(k => updateLayout(`table.columnWidths.${k}`, (defaultLayoutConfig.table.columnWidths as any)[k])); }}>
                                        <PDFControlField label="No." path="table.columnWidths.no" min={5} max={30} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                        <PDFControlField label="Item Code" path="table.columnWidths.itemCode" min={10} max={60} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                        <PDFControlField label="Qty" path="table.columnWidths.qty" min={10} max={40} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                        <PDFControlField label="Unit Price" path="table.columnWidths.unitPrice" min={15} max={60} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                        <PDFControlField label="Total" path="table.columnWidths.total" min={15} max={60} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                    </SectionCard>
                                </div>
                            )}

                            {activeTab === 'footer' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <SectionCard title="Terms & Conditions" icon={<ScrollText className="w-3.5 h-3.5" />} color="purple"
                                        onReset={() => { updateLayout('terms.spacingBefore', defaultLayoutConfig.terms.spacingBefore); updateLayout('terms.titleFontSize', defaultLayoutConfig.terms.titleFontSize); updateLayout('terms.contentFontSize', defaultLayoutConfig.terms.contentFontSize); }}>
                                        <PDFControlField label="Spacing Above" path="terms.spacingBefore" min={0} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                        <PDFControlField label="Title Font" path="terms.titleFontSize" min={8} max={16} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                        <PDFControlField label="Content Font" path="terms.contentFontSize" min={6} max={12} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                    </SectionCard>
                                    <SectionCard title="Signatures" icon={<Type className="w-3.5 h-3.5" />} color="purple"
                                        onReset={() => { updateLayout('footer.y', defaultLayoutConfig.footer.y); updateLayout('footer.preparedBy.x', defaultLayoutConfig.footer.preparedBy.x); updateLayout('footer.approvedBy.x', defaultLayoutConfig.footer.approvedBy.x); }}>
                                        <PDFControlField label="Y Position" path="footer.y" min={150} max={290} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                        <PDFControlField label="Prepared X" path="footer.preparedBy.x" min={10} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                        <PDFControlField label="Approved X" path="footer.approvedBy.x" min={100} max={200} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                    </SectionCard>
                                </div>
                            )}
                        </div>

                        {/* Reset all */}
                        <div className="shrink-0 p-4 border-t border-border/60 bg-card">
                            <button onClick={resetToDefault} className="w-full flex items-center justify-center gap-2 py-2 text-[11px] font-semibold text-muted-foreground border border-border rounded-lg hover:bg-muted hover:text-foreground transition-all">
                                <RotateCcw className="w-3.5 h-3.5" /> Reset All to Default
                            </button>
                        </div>
                    </div>

                    {/* ── Center: A4 Preview ── */}
                    {showPreview && (
                        <div ref={containerRef} className="flex-1 flex flex-col bg-muted/30 overflow-hidden">
                            {/* Preview toolbar */}
                            <div className="flex items-center justify-between px-5 py-2.5 bg-card border-b border-border/60 shrink-0">
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                                    <Eye className="w-3.5 h-3.5 text-blue-500" />
                                    Live Preview
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[10px] font-bold">A4</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground/60 font-mono">
                                    {Math.round(previewScale * 100)}% scale
                                </div>
                            </div>

                            {/* A4 Page */}
                            <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
                                <div
                                    className="relative bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-border/40 ring-1 ring-border/20"
                                    style={{
                                        width: `${A4_WIDTH_MM * MM_TO_PX}px`,
                                        height: `${A4_HEIGHT_MM * MM_TO_PX}px`,
                                        transform: `scale(${previewScale})`,
                                        transformOrigin: 'center center',
                                        flexShrink: 0,
                                    }}
                                >
                                    {/* Margin guides */}
                                    <div className="absolute top-0 bottom-0 border-l border-dashed border-blue-300/40 pointer-events-none" style={{ left: `${layout.table.margins.left * MM_TO_PX}px` }} />
                                    <div className="absolute top-0 bottom-0 border-r border-dashed border-blue-300/40 pointer-events-none" style={{ right: `${layout.table.margins.right * MM_TO_PX}px` }} />

                                    {/* Logo */}
                                    <LiveElement x={layout.header.logo.x} y={layout.header.logo.y} width={layout.header.logo.width} height={layout.header.logo.width * 0.4} path="header.logo">
                                        <div className="w-full h-full bg-blue-50 border border-blue-200 rounded-sm flex items-center justify-center text-blue-400 text-[7px] font-bold uppercase tracking-wider">LOGO</div>
                                    </LiveElement>

                                    {/* Company name */}
                                    <LiveElement x={layout.header.companyName.x} y={layout.header.companyName.y} fontSize={layout.header.companyName.fontSize} bold path="header.companyName">
                                        <span style={{ color: '#004aad' }}>LIMPERIAL TECHNOLOGY CO., LTD</span>
                                    </LiveElement>
                                    <LiveElement x={layout.header.companyName.x} y={layout.header.companyName.y + 5} fontSize={layout.header.contactInfo?.fontSize || 7} path="header.companyName">
                                        <span className="text-gray-500">Tel: (+855) 92 218 333 | info@limperialtech.com</span>
                                    </LiveElement>
                                    <LiveElement x={layout.header.companyName.x} y={layout.header.companyName.y + 9} fontSize={layout.header.address?.fontSize || 7} path="header.companyName">
                                        <span className="text-gray-500">Building #15, Phnom Penh, Cambodia</span>
                                    </LiveElement>

                                    {/* Separator */}
                                    <div className="absolute bg-[#004aad] pointer-events-none" style={{ left: `${layout.table.margins.left * MM_TO_PX}px`, top: `${layout.header.separatorLine.y * MM_TO_PX}px`, width: `${tableContentWidth * MM_TO_PX}px`, height: '1px' }} />

                                    {/* Doc Title */}
                                    <LiveElement x={layout.table.margins.left} y={layout.title?.y ?? 22} width={tableContentWidth} fontSize={layout.title?.fontSize ?? 14} bold align="center" path="title">
                                        <span style={{ textDecoration: 'underline' }}>QUOTATION</span>
                                    </LiveElement>

                                    {/* Info grid */}
                                    <LiveElement x={layout.table.margins.left} y={layout.info.startY} fontSize={layout.info.fontSize} path="info">
                                        <div className="grid gap-y-0.5 text-[7px]" style={{ gridTemplateColumns: '55px 6px 1fr 55px 6px 60px' }}>
                                            {[['Company Name','Senate of Cambodia','Quotation No','Q-0000001'],['Address','Phnom Penh','Quote Date','20 March 2026'],['Contact','Mr. Sample','Validity','27 March 2026'],['Tel','(+855) 12 345 678','Status','In Stock'],['Email','sample@email.com','Payment','COD']].map(([l1,v1,l2,v2],i) => (
                                                <React.Fragment key={i}>
                                                    <span className="text-gray-700">{l1}</span><span className="text-center text-gray-400">:</span><span className="text-gray-900 font-medium">{v1}</span>
                                                    <span className="text-gray-700">{l2}</span><span className="text-center text-gray-400">:</span><span className="text-gray-900">{v2}</span>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </LiveElement>

                                    {/* Table */}
                                    <div className="absolute border border-gray-400 overflow-hidden transition-all duration-200" style={{ left: `${layout.table.margins.left * MM_TO_PX}px`, top: `${layout.table.startY * MM_TO_PX}px`, width: `${tableContentWidth * MM_TO_PX}px` }}>
                                        {/* Header */}
                                        <div className="flex bg-[#004aad] text-white font-bold" style={{ fontSize: `${layout.table.fontSize * 0.75}px` }}>
                                            {[['No', layout.table.columnWidths.no], ['Code', layout.table.columnWidths.itemCode], null, ['Qty', layout.table.columnWidths.qty], ['Price', layout.table.columnWidths.unitPrice], ['Total', layout.table.columnWidths.total]].map((col, i) =>
                                                col === null
                                                    ? <div key={i} className="p-1 border-r border-white/20 flex-1">Description</div>
                                                    : <div key={i} className={`p-1 ${i < 5 ? 'border-r border-white/20' : ''} text-center shrink-0`} style={{ width: `${(col[1] as number) * MM_TO_PX}px` }}>{col[0]}</div>
                                            )}
                                        </div>
                                        {/* Row */}
                                        {[['1','LPC-001','Dell OptiPlex 7020','1','$ 1,190.00','$ 1,200.00'],['','','– Intel Core i7, 512GB SSD, Win 11','','',''],['2','P2725DE','Dell 27" USB-C Monitor WQHD','1','$ 360.00','$ 370.00']].map((row, ri) => (
                                            <div key={ri} className={`flex border-b border-gray-200 ${ri % 2 === 0 && ri > 0 ? 'bg-gray-50/40' : ''}`} style={{ fontSize: `${layout.table.descriptionFontSize * 0.7}px` }}>
                                                <div className="p-1 border-r border-gray-300 text-center shrink-0" style={{ width: `${layout.table.columnWidths.no * MM_TO_PX}px` }}>{row[0]}</div>
                                                <div className="p-1 border-r border-gray-300 shrink-0" style={{ width: `${layout.table.columnWidths.itemCode * MM_TO_PX}px` }}>{row[1]}</div>
                                                <div className={`p-1 border-r border-gray-300 flex-1 ${ri === 0 ? 'font-bold' : 'text-gray-500 italic text-[6px]'}`}>{row[2]}</div>
                                                <div className="p-1 border-r border-gray-300 text-center shrink-0" style={{ width: `${layout.table.columnWidths.qty * MM_TO_PX}px` }}>{row[3]}</div>
                                                <div className="p-1 border-r border-gray-300 text-right shrink-0" style={{ width: `${layout.table.columnWidths.unitPrice * MM_TO_PX}px` }}>{row[4]}</div>
                                                <div className="p-1 text-right shrink-0 font-semibold" style={{ width: `${layout.table.columnWidths.total * MM_TO_PX}px` }}>{row[5]}</div>
                                            </div>
                                        ))}
                                        {/* Totals */}
                                        {[['Sub Total (USD)', '$ 8,410.00', false], ['Grand Total (USD)', '$ 8,410.00', true]].map(([label, val, bold], i) => (
                                            <div key={i} className={`flex ${bold ? 'bg-gray-100 border-t-2 border-gray-800 font-bold' : 'border-b border-gray-200'}`} style={{ fontSize: `${layout.table.fontSize * 0.75}px` }}>
                                                <div className="flex-1 p-1 text-right pr-3 border-r border-gray-300">{label as string}</div>
                                                <div className="p-1 text-right shrink-0" style={{ width: `${layout.table.columnWidths.total * MM_TO_PX}px` }}>{val as string}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Terms */}
                                    <LiveElement x={layout.table.margins.left} y={layout.table.startY + 55 + (layout.terms?.spacingBefore || 0)} width={tableContentWidth} path="terms">
                                        <div className="w-full border-t border-gray-200 pt-1">
                                            <div className="font-bold underline mb-0.5 text-[7px] uppercase text-gray-800">Terms and Conditions</div>
                                            <div className="text-[6.5px] text-gray-600 leading-relaxed">1. Warranty void if seal broken or physical damage.<br />2. Please check items before receiving.</div>
                                        </div>
                                    </LiveElement>

                                    {/* Signatures */}
                                    {[
                                        { label: 'PREPARED BY', x: layout.footer.preparedBy.x },
                                        { label: 'APPROVED BY', x: layout.footer.approvedBy.x }
                                    ].map(sig => (
                                        <React.Fragment key={sig.label}>
                                            <LiveElement x={sig.x - 25} y={layout.footer.y} width={50} bold align="center" fontSize={8} path={`footer.${sig.label === 'PREPARED BY' ? 'preparedBy' : 'approvedBy'}`}>
                                                {sig.label}
                                            </LiveElement>
                                            <div className="absolute h-[1px] bg-gray-600 transition-all duration-300" style={{ left: `${(sig.x - 25) * MM_TO_PX}px`, top: `${(layout.footer.y + 20) * MM_TO_PX}px`, width: `${50 * MM_TO_PX}px` }} />
                                            <LiveElement x={sig.x - 25} y={layout.footer.y + 22} width={50} align="center" fontSize={7} path={`footer.${sig.label === 'PREPARED BY' ? 'preparedBy' : 'approvedBy'}`}>
                                                <span className="text-gray-400 italic">(Signature)</span>
                                            </LiveElement>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/60 bg-card shrink-0 gap-3">
                    <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Changes update in real-time
                    </div>
                    <div className="flex items-center gap-2.5">
                        <button onClick={onClose} className="px-4 py-2 text-[12px] font-semibold text-muted-foreground border border-border rounded-xl hover:bg-muted hover:text-foreground transition-all">
                            Cancel
                        </button>
                        <button
                            onClick={() => onGenerate(layout)}
                            className="flex items-center gap-2 px-6 py-2 text-[12px] font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 transition-all"
                        >
                            <Download className="w-4 h-4" /> Generate PDF
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PDFConfigModal;
