'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, SlidersHorizontal, Layout, Type, Image as ImageIcon, Ruler, ScrollText, RotateCcw, Download, FileText } from 'lucide-react';
import PDFControlField from "../pdf/PDFControlField";
import { PDFLayoutConfig, defaultLayoutConfig } from "../pdf/pdfGenerator";
import { generatePDF } from "@/lib/pdfClient";

interface PDFConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (layout: PDFLayoutConfig) => void;
    currentLayout?: PDFLayoutConfig;
}

const MM_TO_PX = 3; // Scale factor for preview (approx 1mm = 3px on screen)
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

const PDFConfigModal: React.FC<PDFConfigModalProps> = ({ isOpen, onClose, onGenerate, currentLayout }) => {
    const [layout, setLayout] = useState<PDFLayoutConfig>(currentLayout || defaultLayoutConfig);
    const [activeTab, setActiveTab] = useState<'header' | 'table' | 'info' | 'footer'>('header');
    const [hoveredPath, setHoveredPath] = useState<string | null>(null);
    const [previewScale, setPreviewScale] = useState(1);
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateScale = () => {
            if (containerRef.current) {
                const padding = 64;
                const availableWidth = containerRef.current.offsetWidth - padding;
                const availableHeight = containerRef.current.offsetHeight - padding;

                const pageWidth = A4_WIDTH_MM * MM_TO_PX;
                const pageHeight = A4_HEIGHT_MM * MM_TO_PX;

                const scaleX = availableWidth / pageWidth;
                const scaleY = availableHeight / pageHeight;

                setPreviewScale(Math.min(scaleX, scaleY));
            }
        };

        if (isOpen) {
            setLayout(currentLayout || defaultLayoutConfig);
            setTimeout(updateScale, 100);
        }

        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, [isOpen, currentLayout]);

    const updateLayout = (path: string, value: number) => {
        const keys = path.split('.');
        setLayout(prev => {
            const newState = JSON.parse(JSON.stringify(prev));
            let current: any = newState;
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = Number(value);
            return newState;
        });
    };

    const resetToDefault = () => {
        setLayout(defaultLayoutConfig);
    };

    const handleGeneratePDF = async (preview: boolean) => {
        if (preview) {
            onGenerate(layout);
        } else {
            // Mock data for preview generation within the modal if real data isn't provided
            await generatePDF({
                type: 'Quotation',
                headerData: {
                    'Company Name': 'LIMPERIAL TECHNOLOGY CO., LTD',
                    'Company Address': 'Building #15, Street Ayeaksmaiyean Bo (139), Sangkat Srah Chak, Khan Daun Penh, Phnom Penh, Cambodia.',
                    'Contact Person': 'Client Sample',
                    'Contact Tel': '012 345 678',
                    'Contact Email': 'client@example.com',
                    'Quotation ID': 'QT-23-001',
                    'Quote Date': new Date().toISOString(),
                    'Validity Date': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    'Payment Term': 'COD',
                },
                items: [
                    { no: 1, itemCode: 'ITEM-001', modelName: 'MODEL-NAME-X100', description: 'High-Fidelity Sample Product Spec 1', qty: 1, unitPrice: 100, amount: 100 }
                ],
                totals: { subTotal: 100, tax: 10, grandTotal: 110 },
                currency: 'USD',
                previewMode: false,
                filename: 'Quotation_Config_Preview.pdf'
            });
        }
    };

    if (!isOpen) return null;

    // High-Fidelity Live Element
    const LiveElement = ({ x, y, width, height, children, fontSize, path, bold = false, align = 'left' }: {
        x: number, y: number, width?: number, height?: number, children: React.ReactNode, fontSize?: number, path?: string, bold?: boolean, align?: 'left' | 'center' | 'right'
    }) => {
        const isHovered = path && hoveredPath && (hoveredPath === path || path.startsWith(hoveredPath) || hoveredPath.startsWith(path));

        return (
            <div
                className={`absolute transition-all duration-300 font-serif ${isHovered ? 'bg-blue-50 ring-1 ring-blue-400 z-10 scale-[1.01] shadow-sm' : ''} ${bold ? 'font-bold' : 'font-normal'}`}
                style={{
                    left: `${x * MM_TO_PX}px`,
                    top: `${y * MM_TO_PX}px`,
                    width: width ? `${width * MM_TO_PX}px` : 'auto',
                    height: height ? `${height * MM_TO_PX}px` : 'auto',
                    fontSize: fontSize ? `${fontSize * (MM_TO_PX / 3.5)}px` : '10px',
                    textAlign: align,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
                    padding: '1px',
                    lineHeight: '1.2'
                }}
                onMouseEnter={() => path && setHoveredPath(path)}
                onMouseLeave={() => setHoveredPath(null)}
            >
                {children}
            </div>
        );
    };

    const tableContentWidth = A4_WIDTH_MM - layout.table.margins.left - layout.table.margins.right;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-7xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200/80 bg-white">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
                            <SlidersHorizontal className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 tracking-tight">PDF Layout Configuration</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Customize your document layout and styling</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all" aria-label="Close modal">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Main Content Area - Three Panel Layout */}
                <div className="flex flex-1 overflow-hidden relative">
                    {/* Left: Controls */}
                    <div className="w-80 border-r border-gray-200/60 flex flex-col bg-gray-50/30 flex-shrink-0">
                        <div className="flex border-b border-gray-200/60 bg-white/80 backdrop-blur-sm">
                            <button
                                onClick={() => setActiveTab('header')}
                                className={`flex-1 py-4 text-xs font-bold flex items-center justify-center gap-2 transition-all uppercase tracking-wider ${activeTab === 'header' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50/80 hover:text-gray-700'}`}
                            >
                                <ImageIcon className="w-3.5 h-3.5" /> Header
                            </button>
                            <button
                                onClick={() => setActiveTab('info')}
                                className={`flex-1 py-4 text-xs font-bold flex items-center justify-center gap-2 transition-all uppercase tracking-wider ${activeTab === 'info' ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50/50' : 'text-gray-500 hover:bg-gray-50/80 hover:text-gray-700'}`}
                            >
                                <Type className="w-3.5 h-3.5" /> Info
                            </button>
                            <button
                                onClick={() => setActiveTab('table')}
                                className={`flex-1 py-4 text-xs font-bold flex items-center justify-center gap-2 transition-all uppercase tracking-wider ${activeTab === 'table' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-gray-500 hover:bg-gray-50/80 hover:text-gray-700'}`}
                            >
                                <Ruler className="w-3.5 h-3.5" /> Table
                            </button>
                            <button
                                onClick={() => setActiveTab('footer')}
                                className={`flex-1 py-4 text-xs font-bold flex items-center justify-center gap-2 transition-all uppercase tracking-wider ${activeTab === 'footer' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' : 'text-gray-500 hover:bg-gray-50/80 hover:text-gray-700'}`}
                            >
                                <ScrollText className="w-3.5 h-3.5" /> Footer
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {activeTab === 'header' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between mb-2.5">
                                            <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"><ImageIcon className="w-3.5 h-3.5 text-blue-500" /> Logo Position</h3>
                                            <button onClick={() => {
                                                updateLayout('header.logo.x', defaultLayoutConfig.header.logo.x);
                                                updateLayout('header.logo.y', defaultLayoutConfig.header.logo.y);
                                                updateLayout('header.logo.width', defaultLayoutConfig.header.logo.width);
                                            }} className="text-[10px] font-semibold text-gray-400 hover:text-blue-600 flex items-center gap-1 group transition-colors">
                                                <RotateCcw className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform" /> Reset
                                            </button>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="divide-y divide-blue-100/40">
                                                <PDFControlField label="Horizontal (X)" path="header.logo.x" min={0} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                <PDFControlField label="Vertical (Y)" path="header.logo.y" min={0} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                <PDFControlField label="Logo Width" path="header.logo.width" min={10} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"><Type className="w-3.5 h-3.5" /> Company Name</h3>
                                            <button onClick={() => {
                                                updateLayout('header.companyName.x', defaultLayoutConfig.header.companyName.x);
                                                updateLayout('header.companyName.y', defaultLayoutConfig.header.companyName.y);
                                                updateLayout('header.companyName.fontSize', defaultLayoutConfig.header.companyName.fontSize);
                                            }} className="text-[10px] font-semibold text-gray-400 hover:text-blue-600 flex items-center gap-1 group transition-colors">
                                                <RotateCcw className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform" /> Reset
                                            </button>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="divide-y divide-blue-50/50">
                                                <PDFControlField label="Horizontal (X)" path="header.companyName.x" min={0} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                <PDFControlField label="Vertical (Y)" path="header.companyName.y" min={0} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                <PDFControlField label="Co. Font Size" path="header.companyName.fontSize" min={8} max={24} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                <PDFControlField label="Contact Font" path="header.contactInfo.fontSize" min={6} max={14} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                                <PDFControlField label="Address Font" path="header.address.fontSize" min={6} max={14} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"><Ruler className="w-3.5 h-3.5" /> Separator Line</h3>
                                            <button onClick={() => {
                                                updateLayout('header.separatorLine.y', defaultLayoutConfig.header.separatorLine.y);
                                            }} className="text-[10px] font-semibold text-gray-400 hover:text-blue-600 flex items-center gap-1 group transition-colors">
                                                <RotateCcw className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform" /> Reset
                                            </button>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="divide-y divide-blue-100/40">
                                                <PDFControlField label="Vertical Position" path="header.separatorLine.y" min={10} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="blue" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'info' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"><ScrollText className="w-3.5 h-3.5" /> Main Controls</h3>
                                            <button onClick={() => {
                                                updateLayout('info.startY', defaultLayoutConfig.info.startY);
                                                updateLayout('info.fontSize', defaultLayoutConfig.info.fontSize);
                                                updateLayout('info.rowHeight', defaultLayoutConfig.info.rowHeight);
                                            }} className="text-[10px] font-semibold text-gray-400 hover:text-amber-600 flex items-center gap-1 group transition-colors">
                                                <RotateCcw className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform" /> Reset
                                            </button>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="divide-y divide-amber-100/40">
                                                <PDFControlField label="Start Height" path="info.startY" min={30} max={150} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                                <PDFControlField label="Font Size" path="info.fontSize" min={6} max={14} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                                <PDFControlField label="Row Spacing" path="info.rowHeight" min={4} max={15} step={0.1} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"><Layout className="w-3.5 h-3.5" /> Left Column (Col 1)</h3>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="divide-y divide-amber-100/40">
                                                <PDFControlField label="Label Left" path="info.col1.labelX" min={5} max={80} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                                <PDFControlField label="Label Width" path="info.col1.labelWidth" min={10} max={60} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                                <PDFControlField label="Colon Gap" path="info.col1.gap" min={0} max={20} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"><Layout className="w-3.5 h-3.5" /> Right Column (Col 2)</h3>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="divide-y divide-amber-100/40">
                                                <PDFControlField label="Label Left" path="info.col2.labelX" min={100} max={180} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                                <PDFControlField label="Label Width" path="info.col2.labelWidth" min={10} max={60} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                                <PDFControlField label="Colon Gap" path="info.col2.gap" min={0} max={20} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="amber" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'table' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"><Layout className="w-3.5 h-3.5" /> Table Settings</h3>
                                            <button onClick={() => {
                                                updateLayout('table.startY', defaultLayoutConfig.table.startY);
                                                updateLayout('table.fontSize', defaultLayoutConfig.table.fontSize);
                                                updateLayout('table.descriptionFontSize', defaultLayoutConfig.table.descriptionFontSize);
                                            }} className="text-[10px] font-semibold text-gray-400 hover:text-emerald-600 flex items-center gap-1 group transition-colors">
                                                <RotateCcw className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform" /> Reset
                                            </button>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="divide-y divide-emerald-100/40">
                                                <PDFControlField label="Start Height" path="table.startY" min={60} max={250} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                <PDFControlField label="Header Size" path="table.fontSize" min={6} max={14} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                <PDFControlField label="Content Size" path="table.descriptionFontSize" min={6} max={12} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"><Ruler className="w-3.5 h-3.5" /> Margins</h3>
                                            <button onClick={() => {
                                                updateLayout('table.margins.left', defaultLayoutConfig.table.margins.left);
                                                updateLayout('table.margins.right', defaultLayoutConfig.table.margins.right);
                                            }} className="text-[10px] font-semibold text-gray-400 hover:text-emerald-600 flex items-center gap-1 group transition-colors">
                                                <RotateCcw className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform" /> Reset
                                            </button>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="divide-y divide-emerald-100/40">
                                                <PDFControlField label="Left Margin" path="table.margins.left" min={5} max={40} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                <PDFControlField label="Right Margin" path="table.margins.right" min={5} max={40} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"><Layout className="w-3.5 h-3.5" /> Column Widths</h3>
                                            <button onClick={() => {
                                                updateLayout('table.columnWidths.no', defaultLayoutConfig.table.columnWidths.no);
                                                updateLayout('table.columnWidths.itemCode', defaultLayoutConfig.table.columnWidths.itemCode);
                                                updateLayout('table.columnWidths.qty', defaultLayoutConfig.table.columnWidths.qty);
                                                updateLayout('table.columnWidths.unitPrice', defaultLayoutConfig.table.columnWidths.unitPrice);
                                                updateLayout('table.columnWidths.total', defaultLayoutConfig.table.columnWidths.total);
                                            }} className="text-[10px] font-semibold text-gray-400 hover:text-emerald-600 flex items-center gap-1 group transition-colors">
                                                <RotateCcw className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform" /> Reset
                                            </button>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="divide-y divide-emerald-100/40">
                                                <PDFControlField label="No." path="table.columnWidths.no" min={5} max={30} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                <PDFControlField label="Code" path="table.columnWidths.itemCode" min={10} max={60} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                <PDFControlField label="Qty" path="table.columnWidths.qty" min={10} max={40} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                <PDFControlField label="Price" path="table.columnWidths.unitPrice" min={15} max={60} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                                <PDFControlField label="Total" path="table.columnWidths.total" min={15} max={60} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="emerald" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'footer' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"><ScrollText className="w-3.5 h-3.5" /> Terms & Conditions</h3>
                                            <button onClick={() => {
                                                updateLayout('terms.spacingBefore', defaultLayoutConfig.terms.spacingBefore);
                                                updateLayout('terms.titleFontSize', defaultLayoutConfig.terms.titleFontSize);
                                                updateLayout('terms.contentFontSize', defaultLayoutConfig.terms.contentFontSize);
                                            }} className="text-[10px] font-semibold text-gray-400 hover:text-purple-600 flex items-center gap-1 group transition-colors">
                                                <RotateCcw className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform" /> Reset
                                            </button>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="divide-y divide-purple-100/40">
                                                <PDFControlField label="Spacing Above" path="terms.spacingBefore" min={0} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Title Size" path="terms.titleFontSize" min={8} max={16} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Content Size" path="terms.contentFontSize" min={6} max={12} step={0.5} unit="pt" layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"><Type className="w-3.5 h-3.5" /> Signatures</h3>
                                            <button onClick={() => {
                                                updateLayout('footer.y', defaultLayoutConfig.footer.y);
                                                updateLayout('footer.preparedBy.x', defaultLayoutConfig.footer.preparedBy.x);
                                                updateLayout('footer.approvedBy.x', defaultLayoutConfig.footer.approvedBy.x);
                                            }} className="text-[10px] font-semibold text-gray-400 hover:text-purple-600 flex items-center gap-1 group transition-colors">
                                                <RotateCcw className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform" /> Reset
                                            </button>
                                        </div>
                                        <div className="bg-white p-4 rounded-xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="divide-y divide-purple-100/40">
                                                <PDFControlField label="Vert Height" path="footer.y" min={150} max={290} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Prepared (X)" path="footer.preparedBy.x" min={10} max={100} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                                <PDFControlField label="Approved (X)" path="footer.approvedBy.x" min={100} max={200} layout={layout} onUpdate={updateLayout} onHover={setHoveredPath} hoveredPath={hoveredPath} accentColor="purple" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Center: Layout Configuration */}
                    <div ref={containerRef} className="flex-1 flex flex-col bg-gray-200/50 relative overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 z-10">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <Layout className="w-4 h-4 text-blue-500" /> Layout Configuration
                            </h3>
                            <div className="flex items-center gap-3">
                                <div className="text-[10px] font-medium px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                                    Interactive Editor
                                </div>
                                <button
                                    onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                                    className="text-xs font-medium px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    {isRightPanelOpen ? 'Hide' : 'Show'} Quotation
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 flex items-center justify-center p-8 relative">
                            <div className="relative bg-white shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-gray-200 transition-all duration-300"
                                style={{
                                    width: `${A4_WIDTH_MM * MM_TO_PX}px`,
                                    height: `${A4_HEIGHT_MM * MM_TO_PX}px`,
                                    transform: `scale(${previewScale})`,
                                    transformOrigin: 'center center',
                                    flexShrink: 0
                                }}
                            >
                                {/* Margin Guides */}
                                <div className="absolute top-0 bottom-0 border-l border-blue-100 border-dashed opacity-30 pointer-events-none" style={{ left: `${layout.table.margins.left * MM_TO_PX}px` }}></div>
                                <div className="absolute top-0 bottom-0 border-r border-blue-100 border-dashed opacity-30 pointer-events-none" style={{ right: `${layout.table.margins.right * MM_TO_PX}px` }}></div>

                                {/* Logo Placeholder */}
                                <LiveElement
                                    x={layout.header.logo.x}
                                    y={layout.header.logo.y}
                                    width={layout.header.logo.width}
                                    height={layout.header.logo.width * 0.4}
                                    path="header.logo"
                                >
                                    <div className="w-full h-full bg-blue-50 border border-blue-200 rounded flex items-center justify-center text-blue-400 text-[8px]">LOGO</div>
                                </LiveElement>

                                {/* Company Info */}
                                <LiveElement
                                    x={layout.header.companyName.x}
                                    y={layout.header.companyName.y}
                                    fontSize={layout.header.companyName.fontSize}
                                    bold
                                    path="header.companyName"
                                >
                                    LIMPERIAL TECHNOLOGY CO., LTD
                                </LiveElement>

                                <LiveElement x={layout.header.companyName.x} y={layout.header.companyName.y + 5} fontSize={8} path="header.companyName">
                                    No. 123, Street 456, Phnom Penh, Cambodia
                                </LiveElement>

                                {/* Separator Line */}
                                <div
                                    className="absolute bg-[#004aad] transition-all duration-200"
                                    style={{
                                        left: `${layout.table.margins.left * MM_TO_PX}px`,
                                        top: `${layout.header.separatorLine.y * MM_TO_PX}px`,
                                        width: `${(A4_WIDTH_MM - layout.table.margins.left - layout.table.margins.right) * MM_TO_PX}px`,
                                        height: '1px'
                                    }}
                                ></div>

                                {/* Document Title */}
                                <LiveElement
                                    x={layout.table.margins.left}
                                    y={layout.title.y}
                                    width={A4_WIDTH_MM - layout.table.margins.left - layout.table.margins.right}
                                    fontSize={layout.title.fontSize}
                                    bold
                                    align="center"
                                    path="title"
                                >
                                    QUOTATION
                                </LiveElement>

                                {/* Info Grid Section */}
                                <LiveElement x={layout.table.margins.left} y={layout.info.startY} fontSize={9} path="info">
                                    <div className="grid grid-cols-2 gap-x-12 gap-y-1">
                                        <div className="flex gap-2"><span>Date:</span> <span className="font-semibold underline decoration-dotted">27-Dec-2023</span></div>
                                        <div className="flex gap-2"><span>No:</span> <span className="font-semibold underline decoration-dotted">QT-23-001</span></div>
                                        <div className="flex gap-2"><span>Name:</span> <span className="font-semibold underline decoration-dotted">Client Sample</span></div>
                                        <div className="flex gap-2"><span>Phone:</span> <span className="font-semibold underline decoration-dotted">012 345 678</span></div>
                                    </div>
                                </LiveElement>

                                {/* Main Table Rendering */}
                                <div
                                    className="absolute transition-all duration-300 border border-gray-800"
                                    style={{
                                        left: `${layout.table.margins.left * MM_TO_PX}px`,
                                        top: `${layout.table.startY * MM_TO_PX}px`,
                                        width: `${tableContentWidth * MM_TO_PX}px`,
                                    }}
                                >
                                    {/* Table Header Row */}
                                    <div className="flex bg-[#004aad] text-white font-bold" style={{ fontSize: `${layout.table.fontSize * 0.8}px` }}>
                                        <div className="p-1 border-r border-white/20 text-center" style={{ width: `${layout.table.columnWidths.no * MM_TO_PX}px` }}>No</div>
                                        <div className="p-1 border-r border-white/20" style={{ width: `${layout.table.columnWidths.itemCode * MM_TO_PX}px` }}>Code</div>
                                        <div className="p-1 border-r border-white/20 flex-grow">Description of Goods</div>
                                        <div className="p-1 border-r border-white/20 text-center" style={{ width: `${layout.table.columnWidths.qty * MM_TO_PX}px` }}>Qty</div>
                                        <div className="p-1 border-r border-white/20 text-right" style={{ width: `${layout.table.columnWidths.unitPrice * MM_TO_PX}px` }}>Price</div>
                                        <div className="p-1 text-right" style={{ width: `${layout.table.columnWidths.total * MM_TO_PX}px` }}>Total</div>
                                    </div>
                                    {/* Mock Data Row 1 (Model) */}
                                    <div className="flex border-b border-gray-100" style={{ fontSize: `${layout.table.fontSize * 0.75}px` }}>
                                        <div className="p-1 border-r border-gray-300 text-center flex items-center justify-center font-medium" style={{ width: `${layout.table.columnWidths.no * MM_TO_PX}px` }}>1</div>
                                        <div className="p-1 border-r border-gray-300 flex items-center justify-center font-medium" style={{ width: `${layout.table.columnWidths.itemCode * MM_TO_PX}px` }}>ITEM-001</div>
                                        <div className="p-1 border-r border-gray-300 flex-grow font-bold bg-slate-50/30">MODEL-NAME-X100</div>
                                        <div className="p-1 border-r border-gray-300 text-center flex items-center justify-center font-medium" style={{ width: `${layout.table.columnWidths.qty * MM_TO_PX}px` }}>1.00</div>
                                        <div className="p-1 border-r border-gray-300 text-right flex items-center justify-end px-2" style={{ width: `${layout.table.columnWidths.unitPrice * MM_TO_PX}px` }}>$110.00</div>
                                        <div className="p-1 text-right font-bold flex items-center justify-end px-2" style={{ width: `${layout.table.columnWidths.total * MM_TO_PX}px` }}>$110.00</div>
                                    </div>
                                    {/* Mock Data Row 2 (Description) */}
                                    <div className="flex border-b border-gray-300" style={{ fontSize: `${layout.table.descriptionFontSize * 0.7}px` }}>
                                        <div className="p-1 border-r border-gray-300" style={{ width: `${layout.table.columnWidths.no * MM_TO_PX}px` }}></div>
                                        <div className="p-1 border-r border-gray-300" style={{ width: `${layout.table.columnWidths.itemCode * MM_TO_PX}px` }}></div>
                                        <div className="p-1 border-r border-gray-300 flex-grow font-medium italic text-gray-600 leading-tight">
                                            - High-Fidelity Sample Product Spec 1<br />
                                            - Dynamic margins and real-time positioning<br />
                                            - Multi-line support for detailed configuration
                                        </div>
                                        <div className="p-1 border-r border-gray-300" style={{ width: `${layout.table.columnWidths.qty * MM_TO_PX}px` }}></div>
                                        <div className="p-1 border-r border-gray-300" style={{ width: `${layout.table.columnWidths.unitPrice * MM_TO_PX}px` }}></div>
                                        <div className="p-1 text-right" style={{ width: `${layout.table.columnWidths.total * MM_TO_PX}px` }}></div>
                                    </div>
                                    {/* Mock Totals */}
                                    <div className="flex border-b border-gray-300 bg-gray-50/20" style={{ fontSize: `${layout.table.fontSize * 0.75}px` }}>
                                        <div className="flex-grow p-1 text-right font-bold pr-4" style={{ width: `${(tableContentWidth - layout.table.columnWidths.total) * MM_TO_PX}px` }}>Sub Total (USD)</div>
                                        <div className="p-1 text-right font-bold border-l border-gray-300" style={{ width: `${layout.table.columnWidths.total * MM_TO_PX}px` }}>$100.00</div>
                                    </div>
                                    <div className="flex border-b border-gray-300" style={{ fontSize: `${layout.table.fontSize * 0.75}px` }}>
                                        <div className="flex-grow p-1 text-right font-bold pr-4" style={{ width: `${(tableContentWidth - layout.table.columnWidths.total) * MM_TO_PX}px` }}>VAT 10% (USD)</div>
                                        <div className="p-1 text-right font-bold border-l border-gray-300" style={{ width: `${layout.table.columnWidths.total * MM_TO_PX}px` }}>$10.00</div>
                                    </div>
                                    <div className="flex bg-blue-50/30" style={{ fontSize: `${layout.table.fontSize * 0.8}px` }}>
                                        <div className="flex-grow p-1 text-right font-black pr-4 uppercase text-blue-900" style={{ width: `${(tableContentWidth - layout.table.columnWidths.total) * MM_TO_PX}px` }}>Grand Total (USD)</div>
                                        <div className="p-1 text-right font-black border-l border-blue-200 text-blue-900" style={{ width: `${layout.table.columnWidths.total * MM_TO_PX}px` }}>$110.00</div>
                                    </div>
                                </div>

                                {/* Terms & Conditions Section */}
                                <LiveElement
                                    x={layout.table.margins.left}
                                    y={layout.table.startY + 50 + (layout.terms.spacingBefore || 0)}
                                    width={A4_WIDTH_MM - layout.table.margins.left - layout.table.margins.right}
                                    path="terms"
                                >
                                    <div className="border-t border-gray-200 pt-2">
                                        <div className="font-bold underline mb-1 uppercase text-blue-900" style={{ fontSize: `${layout.terms.titleFontSize * 0.75}px` }}>Terms & Conditions:</div>
                                        <div className="leading-relaxed text-gray-700" style={{ fontSize: `${layout.terms.contentFontSize * 0.75}px`, whiteSpace: 'pre-line' }}>
                                            1. Warranty void if seal broken or physical damage.<br />
                                            2. Goods sold are not returnable or exchangeable.<br />
                                            3. Please check the items before receiving.
                                        </div>
                                    </div>
                                </LiveElement>

                                {/* Signature Footers */}
                                <LiveElement
                                    x={layout.footer.preparedBy.x - 25}
                                    y={layout.footer.y}
                                    width={50}
                                    bold
                                    align="center"
                                    fontSize={9}
                                    path="footer.preparedBy"
                                >
                                    PREPARED BY
                                </LiveElement>
                                <LiveElement
                                    x={layout.footer.approvedBy.x - 25}
                                    y={layout.footer.y}
                                    width={50}
                                    bold
                                    align="center"
                                    fontSize={9}
                                    path="footer.approvedBy"
                                >
                                    APPROVED BY
                                </LiveElement>

                                {/* Real-time Signature Lines */}
                                <div className="absolute h-[1px] bg-gray-600 transition-all duration-300" style={{ left: `${(layout.footer.preparedBy.x - 25) * MM_TO_PX}px`, top: `${(layout.footer.y + 20) * MM_TO_PX}px`, width: `${50 * MM_TO_PX}px` }}></div>
                                <div className="absolute h-[1px] bg-gray-600 transition-all duration-300" style={{ left: `${(layout.footer.approvedBy.x - 25) * MM_TO_PX}px`, top: `${(layout.footer.y + 20) * MM_TO_PX}px`, width: `${50 * MM_TO_PX}px` }}></div>

                                <LiveElement x={layout.footer.preparedBy.x - 25} y={layout.footer.y + 22} width={50} align="center" fontSize={8} path="footer.preparedBy">
                                    <span className="text-gray-400 italic font-normal">(Name & Signature)</span>
                                </LiveElement>
                                <LiveElement x={layout.footer.approvedBy.x - 25} y={layout.footer.y + 22} width={50} align="center" fontSize={8} path="footer.approvedBy">
                                    <span className="text-gray-400 italic font-normal">(Authorized Person)</span>
                                </LiveElement>
                            </div>
                        </div>
                    </div>

                    {/* Right: Floating Quotation Creator Panel */}
                    <div
                        className={`absolute top-0 right-0 h-full bg-white border-l border-gray-300 shadow-2xl transition-transform duration-300 ease-in-out z-20 ${isRightPanelOpen ? 'translate-x-0' : 'translate-x-full'
                            }`}
                        style={{ width: '400px' }}
                    >
                        <div className="h-full flex flex-col">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-emerald-50">
                                <h3 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Quotation Creator
                                </h3>
                                <button
                                    onClick={() => setIsRightPanelOpen(false)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                    aria-label="Close panel"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="space-y-4">
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                                        <FileText className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
                                        <p className="text-sm text-emerald-800 font-medium">Quotation Creator</p>
                                        <p className="text-xs text-emerald-600 mt-1">Configure your quotation details here</p>
                                    </div>

                                    {/* Placeholder for quotation form */}
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Company Name</label>
                                            <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Enter company name" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Contact Person</label>
                                            <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Enter contact name" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                                            <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" placeholder="Enter phone number" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Quotation Date</label>
                                            <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200/80 bg-white">
                    <button
                        onClick={resetToDefault}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm hover:shadow"
                    >
                        <RotateCcw className="w-4 h-4" /> Reset to Default
                    </button>
                    <button
                        onClick={() => onGenerate(layout)}
                        className="flex items-center gap-2.5 px-7 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
                    >
                        <Download className="w-4 h-4" /> Generate PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PDFConfigModal;

