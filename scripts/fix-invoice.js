const fs = require('fs');
const path = require('path');

const destDir = path.join(__dirname, '../components/features/sales/invoice');
const invoiceCreatorPath = path.join(destDir, 'InvoiceCreator.tsx');

let content = fs.readFileSync(invoiceCreatorPath, 'utf8');

// The PDFControls component block
const pdfStartStr = `<div className={\`w-full border-b border-gray-200 flex flex-col bg-white transition-all duration-300 ease-in-out flex-shrink-0 \${showLayoutControls ? 'h-[320px] opacity-100' : 'h-0 opacity-0 overflow-hidden'}\`}>`;
const pdfEndStr = `</ScrollArea>\n                        </div>`;

const startIndex = content.indexOf(pdfStartStr);
if (startIndex !== -1) {
    const endIndex = content.indexOf(pdfEndStr, startIndex) + pdfEndStr.length;
    const pdfCode = content.substring(startIndex, endIndex);

    const pdfContent = `import React from 'react';
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
        ${pdfCode}
    );
};
`;

    fs.writeFileSync(path.join(destDir, 'InvoicePDFControls.tsx'), pdfContent);
    content = content.substring(0, startIndex) + `<InvoicePDFControls showLayoutControls={showLayoutControls} activeTab={activeTab} setActiveTab={setActiveTab} handleSaveLayout={handleSaveLayout} setShowPdfConfig={setShowPdfConfig} pdfLayout={pdfLayout} updateLayout={updateLayout} hoveredPath={hoveredPath} setHoveredPath={setHoveredPath} />` + content.substring(endIndex);
    
    fs.writeFileSync(invoiceCreatorPath, content);
} else {
    console.log("Could not find PDF controls block");
}

// Now replace the import in InvoiceDODashboard
const dashboardPath = path.join(__dirname, '../components/dashboards/sales/InvoiceDODashboard.tsx');
if (fs.existsSync(dashboardPath)) {
    let dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    dashboardContent = dashboardContent.replace(`import InvoiceCreator from "../../features/sales/InvoiceCreator";`, `import InvoiceCreator from "../../features/sales/invoice/InvoiceCreator";`);
    fs.writeFileSync(dashboardPath, dashboardContent);
}

// Remove the old InvoiceCreator.tsx
const oldCreatorPath = path.join(__dirname, '../components/features/sales/InvoiceCreator.tsx');
if (fs.existsSync(oldCreatorPath)) {
    fs.unlinkSync(oldCreatorPath);
}

console.log("Fix done.");
