const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../components/features/sales/InvoiceCreator.tsx');
const destDir = path.join(__dirname, '../components/features/sales/invoice');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

let lines = fs.readFileSync(srcPath, 'utf8').split('\n');

// Types
const typesContent = `export interface LineItem {
    id: string;
    no: number;
    itemCode: string;
    modelName: string;
    description: string;
    qty: number | string;
    unitPrice: number | string;
    amount: number;
}
`;
fs.writeFileSync(path.join(destDir, 'types.ts'), typesContent);

// PricelistCombobox
const comboboxCode = lines.slice(44, 122).join('\n');
const comboboxContent = `import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from "../../../../contexts/DataContext";
import { LineItem } from "./types";

${comboboxCode}
export { PricelistCombobox, lineItemInputClasses };
`;
fs.writeFileSync(path.join(destDir, 'PricelistCombobox.tsx'), comboboxContent);

// PDF Controls
const pdfCode = lines.slice(617, 822).join('\n');
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

// Preview
const previewCode = lines.slice(824, 857).join('\n');
const previewContent = `import React from 'react';
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
${previewCode}
    );
};
`;
fs.writeFileSync(path.join(destDir, 'InvoicePreview.tsx'), previewContent);

// Form
const formCode = lines.slice(859, 1027).join('\n');
const formContent = `import React from 'react';
import { Invoice } from "../../../../types";
import { LineItem } from "./types";
import { FormSection, FormInput, FormSelect, FormTextarea } from "../../../common/FormControls";
import SearchableSelect from "../../../common/SearchableSelect";
import { ScrollArea } from "../../../ui/scroll-area";
import Spinner from "../../../common/Spinner";
import { Trash2, X, Upload, Plus } from 'lucide-react';
import { PricelistCombobox } from "./PricelistCombobox";

interface InvoiceFormProps {
    invoice: Partial<Invoice>;
    setInvoice: React.Dispatch<React.SetStateAction<Partial<Invoice>>>;
    items: LineItem[];
    setItems: React.Dispatch<React.SetStateAction<LineItem[]>>;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
    handleSOSelect: (soNo: string) => void;
    soOptions: string[];
    handleCompanySelect: (companyName: string) => void;
    companyOptions: string[];
    removeItem: (id: string) => void;
    handleItemChange: (id: string, field: keyof Omit<LineItem, 'id' | 'amount' | 'no'>, value: string | number) => void;
    handlePricelistItemSelect: (item: LineItem, p: any) => void;
    addItem: () => void;
    totals: { subTotal: number; tax: number; grandTotal: number; };
    fileInputRef: React.RefObject<HTMLInputElement>;
    handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isUploading: boolean;
    showFormPanel: boolean;
    setShowFormPanel: (show: boolean) => void;
    STATUS_OPTIONS: Invoice['Status'][];
    TAXABLE_OPTIONS: string[];
    CURRENCY_OPTIONS: ('USD' | 'KHR')[];
    getCurrencySymbol: (currency?: 'USD' | 'KHR') => string;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
    invoice, setInvoice, items, setItems, handleInputChange, handleSOSelect, soOptions,
    handleCompanySelect, companyOptions, removeItem, handleItemChange, handlePricelistItemSelect,
    addItem, totals, fileInputRef, handleFileUpload, isUploading, showFormPanel, setShowFormPanel,
    STATUS_OPTIONS, TAXABLE_OPTIONS, CURRENCY_OPTIONS, getCurrencySymbol
}) => {
    return (
${formCode}
    );
};
`;
fs.writeFileSync(path.join(destDir, 'InvoiceForm.tsx'), formContent);


// Re-build InvoiceCreator
// Splice out the parts
let newLines = [...lines];

// Replace Form
newLines.splice(859, 168, '                        <InvoiceForm invoice={invoice} setInvoice={setInvoice} items={items} setItems={setItems} handleInputChange={handleInputChange} handleSOSelect={handleSOSelect} soOptions={soOptions} handleCompanySelect={handleCompanySelect} companyOptions={companyOptions} removeItem={removeItem} handleItemChange={handleItemChange} handlePricelistItemSelect={handlePricelistItemSelect} addItem={addItem} totals={totals} fileInputRef={fileInputRef} handleFileUpload={handleFileUpload} isUploading={isUploading} showFormPanel={showFormPanel} setShowFormPanel={setShowFormPanel} STATUS_OPTIONS={STATUS_OPTIONS} TAXABLE_OPTIONS={TAXABLE_OPTIONS} CURRENCY_OPTIONS={CURRENCY_OPTIONS} getCurrencySymbol={getCurrencySymbol} />');

// Replace Preview
newLines.splice(824, 33, '                        <InvoicePreview previewMode={previewMode} invoice={invoice} items={items} printableProps={printableProps} />');

// Replace PDF Controls
newLines.splice(617, 205, '                        <InvoicePDFControls showLayoutControls={showLayoutControls} activeTab={activeTab} setActiveTab={setActiveTab} handleSaveLayout={handleSaveLayout} setShowPdfConfig={setShowPdfConfig} pdfLayout={pdfLayout} updateLayout={updateLayout} hoveredPath={hoveredPath} setHoveredPath={setHoveredPath} />');

// Replace Combobox
newLines.splice(44, 78, '');

// Replace interface LineItem
let interfaceStart = newLines.findIndex(l => l.includes('interface LineItem {'));
if (interfaceStart !== -1) {
    newLines.splice(interfaceStart, 10, 'import { LineItem } from "./types";', 'import { InvoicePreview } from "./InvoicePreview";', 'import { InvoicePDFControls } from "./InvoicePDFControls";', 'import { InvoiceForm } from "./InvoiceForm";');
}

fs.writeFileSync(path.join(destDir, 'InvoiceCreator.tsx'), newLines.join('\n'));

// Replace import in InvoiceDODashboard
const dashboardPath = path.join(__dirname, '../components/dashboards/sales/InvoiceDODashboard.tsx');
if (fs.existsSync(dashboardPath)) {
    let dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    dashboardContent = dashboardContent.replace(`import InvoiceCreator from "../../features/sales/InvoiceCreator";`, `import InvoiceCreator from "../../features/sales/invoice/InvoiceCreator";`);
    fs.writeFileSync(dashboardPath, dashboardContent);
}

// Remove original InvoiceCreator.tsx
fs.unlinkSync(srcPath);

console.log("Refactoring complete.");
