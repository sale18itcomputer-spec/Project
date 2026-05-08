const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../components/features/sales/InvoiceCreator.tsx');
const destDir = path.join(__dirname, '../components/features/sales/invoice');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

let content = fs.readFileSync(srcPath, 'utf8');

// 1. Types
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

// 2. Extract PricelistCombobox
const comboboxRegex = /(const lineItemInputClasses[\s\S]*?)(?=const getTodayDateString)/;
const comboboxMatch = content.match(comboboxRegex);
if (comboboxMatch) {
    const comboboxCode = comboboxMatch[1];
    const comboboxContent = `import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from "../../../../contexts/DataContext";
import { LineItem } from "./types";

${comboboxCode.replace(/interface LineItem \{[\s\S]*?\}/, '')}
export { PricelistCombobox };
`;
    fs.writeFileSync(path.join(destDir, 'PricelistCombobox.tsx'), comboboxContent);
    content = content.replace(comboboxRegex, '');
}

// 3. Extract InvoicePreview
const previewRegex = /<div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">[\s\S]*?{previewMode === 'do' \? \([\s\S]*?<PrintableDO[\s\S]*?\/>\s*\) : \([\s\S]*?<PrintableInvoice[\s\S]*?\/>\s*\)}[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const previewMatch = content.match(previewRegex);
if (previewMatch) {
    const previewCode = previewMatch[0];
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
    content = content.replace(previewRegex, `<InvoicePreview previewMode={previewMode} invoice={invoice} items={items} printableProps={printableProps} />`);
}

// 4. Extract PDFControls
const pdfControlsRegex = /<div className={`w-full border-b border-gray-200 flex flex-col bg-white transition-all duration-300 ease-in-out flex-shrink-0 \${showLayoutControls \? 'h-\[320px\] opacity-100' : 'h-0 opacity-0 overflow-hidden'}`}>\s*<div className="flex justify-center border-b border-gray-200 bg-gray-50">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/ScrollArea>\s*<\/div>/;

const pdfControlsMatch = content.match(pdfControlsRegex);
if (pdfControlsMatch) {
    let pdfCode = pdfControlsMatch[0];
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
    content = content.replace(pdfControlsRegex, `<InvoicePDFControls showLayoutControls={showLayoutControls} activeTab={activeTab} setActiveTab={setActiveTab} handleSaveLayout={handleSaveLayout} setShowPdfConfig={setShowPdfConfig} pdfLayout={pdfLayout} updateLayout={updateLayout} hoveredPath={hoveredPath} setHoveredPath={setHoveredPath} />`);
}

// 5. Extract InvoiceForm
const formRegex = /<div className={`bg-white border-l border-gray-200 transition-all duration-300 ease-in-out flex flex-col flex-shrink-0 \${showFormPanel \? 'w-\[500px\] opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'}`}>\s*<div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-white">[\s\S]*?<\/div>\s*<\/ScrollArea>\s*<\/div>/;

const formMatch = content.match(formRegex);
if (formMatch) {
    const formCode = formMatch[0];
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
    content = content.replace(formRegex, `<InvoiceForm invoice={invoice} setInvoice={setInvoice} items={items} setItems={setItems} handleInputChange={handleInputChange} handleSOSelect={handleSOSelect} soOptions={soOptions} handleCompanySelect={handleCompanySelect} companyOptions={companyOptions} removeItem={removeItem} handleItemChange={handleItemChange} handlePricelistItemSelect={handlePricelistItemSelect} addItem={addItem} totals={totals} fileInputRef={fileInputRef} handleFileUpload={handleFileUpload} isUploading={isUploading} showFormPanel={showFormPanel} setShowFormPanel={setShowFormPanel} STATUS_OPTIONS={STATUS_OPTIONS} TAXABLE_OPTIONS={TAXABLE_OPTIONS} CURRENCY_OPTIONS={CURRENCY_OPTIONS} getCurrencySymbol={getCurrencySymbol} />`);
}

// 6. Fix imports in InvoiceCreator.tsx
content = content.replace(/interface LineItem \{[\s\S]*?\}/, `import { LineItem } from "./types";\nimport { InvoicePreview } from "./InvoicePreview";\nimport { InvoicePDFControls } from "./InvoicePDFControls";\nimport { InvoiceForm } from "./InvoiceForm";`);

fs.writeFileSync(path.join(destDir, 'InvoiceCreator.tsx'), content);
console.log("Done refactoring.");
