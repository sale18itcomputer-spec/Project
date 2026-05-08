const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../components/features/sales/InvoiceCreator.tsx');
const destDir = path.join(__dirname, '../components/features/sales/invoice');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

const content = fs.readFileSync(srcPath, 'utf8');

// 1. Extract LineItem interface
const lineItemMatch = content.match(/interface LineItem \{[\s\S]*?\}/);
const lineItemInterface = lineItemMatch ? lineItemMatch[0] : '';

// 2. Extract PricelistCombobox
const comboboxMatch = content.match(/(const lineItemInputClasses[\s\S]*?)(const getTodayDateString)/);
const comboboxCode = comboboxMatch ? comboboxMatch[1] : '';

// We need to pass a lot of props if we separate InvoicePDFControls, InvoicePreview, InvoiceForm.
// Let's create InvoicePreview.tsx
const previewProps = `import React from 'react';
import PrintableInvoice from "../../../pdf/PrintableInvoice";
import PrintableDO from "../../../pdf/PrintableDO";
import { Invoice } from "../../../../types";
import { LineItem } from "./types";

interface InvoicePreviewProps {
    previewMode: 'invoice' | 'do';
    invoice: Partial<Invoice>;
    items: LineItem[];
    printableProps: any;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({ previewMode, invoice, items, printableProps }) => {
    return (
        <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-800">{previewMode === 'do' ? 'Delivery Order' : 'Invoice'} Preview</h3>
                        <p className="text-[10px] text-gray-500">{invoice['Inv No']} • {invoice['Company Name'] || 'No Company Selected'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-500 font-medium px-2">Real-time Preview</div>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-100 p-4 flex justify-center">
                <div className="w-[794px] min-h-[1123px] bg-white shadow-lg">
                    {previewMode === 'do' ? (
                        <PrintableDO
                            headerData={printableProps.headerData}
                            items={items.filter(item => item.no > 0)}
                        />
                    ) : (
                        <PrintableInvoice
                            headerData={printableProps.headerData}
                            items={items.filter(item => item.no > 0)}
                            totals={printableProps.totals}
                            currency={printableProps.currency}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
`;

fs.writeFileSync(path.join(destDir, 'InvoicePreview.tsx'), previewProps);

// Let's extract the PDF controls
const pdfControlsProps = `import React from 'react';
import { ScrollArea } from "../../../ui/scroll-area";
import PDFControlField from "../../../pdf/PDFControlField";
import { PDFLayoutConfig, defaultLayoutConfig } from "../../../pdf/pdfGenerator";
import { Save, RotateCcw, ImageIcon, Type, Ruler, ScrollText, Layout } from 'lucide-react';

interface InvoicePDFControlsProps {
    showLayoutControls: boolean;
    activeTab: 'header' | 'table' | 'footer';
    setActiveTab: (tab: 'header' | 'table' | 'footer') => void;
    handleSaveLayout: () => void;
    setShowPdfConfig: (show: boolean) => void;
    pdfLayout: PDFLayoutConfig;
    updateLayout: (path: string, value: any) => void;
    hoveredPath: string | null;
    setHoveredPath: (path: string | null) => void;
}

export const InvoicePDFControls: React.FC<InvoicePDFControlsProps> = ({
    showLayoutControls, activeTab, setActiveTab, handleSaveLayout, setShowPdfConfig,
    pdfLayout, updateLayout, hoveredPath, setHoveredPath
}) => {
    return (
        <div className={\`w-full border-b border-gray-200 flex flex-col bg-white transition-all duration-300 ease-in-out flex-shrink-0 \${showLayoutControls ? 'h-[320px] opacity-100' : 'h-0 opacity-0 overflow-hidden'}\`}>
            {/* We will replace this in the main file using a regex replace. Let's just create the component wrapper */}
            {/* The content will be extracted directly from InvoiceCreator.tsx */}
        </div>
    );
};
`;

console.log("Created preliminary files.");
