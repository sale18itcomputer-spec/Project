# Implementation Guide: PDF Configuration for Sales Orders & Invoices

## Overview
This guide explains how to add the professional PDF configuration system (PDFConfigModal + PDFControlField) to SaleOrderCreator and InvoiceCreator components, matching the implementation in QuotationCreator.

## Required Files
- `components/PDFConfigModal.tsx` ✅ (Already exists)
- `components/PDFControlField.tsx` ✅ (Already exists)
- `utils/pdfGenerator.ts` ✅ (Already exists)

## Implementation Steps

### Step 1: Update Imports

Add these imports to both `SaleOrderCreator.tsx` and `InvoiceCreator.tsx`:

```typescript
import { PDFLayoutConfig, defaultLayoutConfig, generatePDF } from '../utils/pdfGenerator';
import PDFConfigModal from './PDFConfigModal';
import PDFControlField from './PDFControlField';
import { SlidersHorizontal, PanelRight, RotateCcw, ImageIcon, Type, Ruler, ScrollText, Layout } from 'lucide-react';
```

### Step 2: Add State Variables

Add these state variables inside the component:

```typescript
const [pdfLayout, setPdfLayout] = useState<PDFLayoutConfig>(defaultLayoutConfig);
const [showPdfConfig, setShowPdfConfig] = useState(false);
const [showLayoutControls, setShowLayoutControls] = useState(false);
const [showFormPanel, setShowFormPanel] = useState(true);
const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>('');
```

### Step 3: Add Layout Update Function

```typescript
const updateLayout = (path: string, value: number) => {
    const keys = path.split('.');
    setPdfLayout(prev => {
        const newLayout = JSON.parse(JSON.stringify(prev));
        let current: any = newLayout;
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        return newLayout;
    });
};

const resetLayout = () => {
    setPdfLayout(defaultLayoutConfig);
};
```

### Step 4: Add PDF Generation Effect

Add this useEffect to generate PDF preview when data or layout changes:

```typescript
useEffect(() => {
    const timer = setTimeout(async () => {
        if (!saleOrder.CompanyName) return; // Or invoiceData.CompanyName for invoices
        
        try {
            const url = await generatePDF({
                type: 'sale-order', // or 'invoice' for invoices
                data: {
                    // Map your sale order/invoice data here
                    companyName: saleOrder.CompanyName,
                    address: selectedCompany?.Address || '',
                    tel: selectedCompany?.Tel || '',
                    email: selectedCompany?.Email || '',
                    quotationNo: saleOrder.SaleOrderNo,
                    quoteDate: saleOrder.SaleOrderDate,
                    customerName: selectedContact?.Name || '',
                    items: items.map(item => ({
                        no: item.no,
                        itemCode: item.itemCode,
                        model: item.modelName,
                        description: item.description,
                        qty: Number(item.qty) || 0,
                        unitPrice: Number(item.unitPrice) || 0,
                        total: item.amount
                    })),
                    subtotal: totals.subtotal,
                    commission: totals.commission,
                    vat: totals.vat,
                    grandTotal: totals.grandTotal,
                    terms: saleOrder.TermsAndConditions || DEFAULT_TERMS,
                    preparedBy: user?.Name || '',
                    approvedBy: ''
                },
                layout: pdfLayout,
                previewMode: true
            });
            
            if (typeof url === 'string') {
                setPdfPreviewUrl(url);
            }
        } catch (error) {
            console.error('PDF generation error:', error);
        }
    }, 800);
    
    return () => clearTimeout(timer);
}, [saleOrder, items, totals, pdfLayout, selectedCompany, selectedContact, user]);
```

### Step 5: Add Header Action Buttons

Replace or enhance the existing header buttons with:

```typescript
<div className="flex items-center gap-2">
    {/* Toggle Layout Controls */}
    <button
        onClick={() => setShowLayoutControls(!showLayoutControls)}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            showLayoutControls 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
        }`}
        title="Toggle Layout Controls"
    >
        <SlidersHorizontal className="w-4 h-4" />
        Layout
    </button>

    {/* Toggle Form Panel */}
    <button
        onClick={() => setShowFormPanel(!showFormPanel)}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            showFormPanel 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
        }`}
        title="Toggle Form Panel"
    >
        <PanelRight className="w-4 h-4" />
        Form
    </button>

    {/* Print Button */}
    <button
        onClick={handlePrint}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
    >
        <Printer className="w-4 h-4" />
        Print
    </button>

    {/* Download PDF */}
    <button
        onClick={handleDownloadPDF}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
    >
        <Download className="w-4 h-4" />
        Download
    </button>

    {/* Save Button */}
    <button
        onClick={handleSave}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-md"
    >
        <Save className="w-4 h-4" />
        Save
    </button>
</div>
```

### Step 6: Add Layout Structure

Replace the main content area with this three-panel layout:

```typescript
<div className="flex-1 flex gap-4 overflow-hidden">
    {/* Left Panel: PDF Layout Controls (Collapsible) */}
    {showLayoutControls && (
        <div className="w-80 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Quick Layout</h3>
                <button
                    onClick={resetLayout}
                    className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
                >
                    <RotateCcw className="w-3 h-3" /> Reset
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Logo Section */}
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                        <ImageIcon className="w-3.5 h-3.5 text-blue-500" /> Logo
                    </h4>
                    <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-1">
                        <PDFControlField label="Width" path="header.logo.width" min={10} max={100} 
                            layout={pdfLayout} onUpdate={updateLayout} onHover={() => {}} hoveredPath={null} accentColor="blue" />
                        <PDFControlField label="X Position" path="header.logo.x" min={0} max={100} 
                            layout={pdfLayout} onUpdate={updateLayout} onHover={() => {}} hoveredPath={null} accentColor="blue" />
                        <PDFControlField label="Y Position" path="header.logo.y" min={0} max={100} 
                            layout={pdfLayout} onUpdate={updateLayout} onHover={() => {}} hoveredPath={null} accentColor="blue" />
                    </div>
                </div>

                {/* Add more sections as needed */}
            </div>
        </div>
    )}

    {/* Center Panel: PDF Preview */}
    <div className="flex-1 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
        {pdfPreviewUrl ? (
            <iframe
                src={pdfPreviewUrl}
                className="w-full h-full border-0"
                title="PDF Preview"
            />
        ) : (
            <div className="text-center text-gray-500">
                <p>Fill in the form to see preview</p>
            </div>
        )}
    </div>

    {/* Right Panel: Form (Collapsible) */}
    {showFormPanel && (
        <div className="w-96 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Sale Order Details</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Your existing form fields here */}
            </div>
        </div>
    )}
</div>
```

### Step 7: Add PDFConfigModal

Add this before the closing tag of your component:

```typescript
{/* PDF Configuration Modal */}
<PDFConfigModal
    isOpen={showPdfConfig}
    onClose={() => setShowPdfConfig(false)}
    onGenerate={(layout) => {
        setPdfLayout(layout);
        setShowPdfConfig(false);
    }}
    currentLayout={pdfLayout}
/>
```

### Step 8: Update Download PDF Function

```typescript
const handleDownloadPDF = async () => {
    try {
        const url = await generatePDF({
            type: 'sale-order', // or 'invoice'
            data: {
                // Same data structure as in the preview effect
            },
            layout: pdfLayout,
            previewMode: false
        });
        
        if (typeof url === 'string') {
            const link = document.createElement('a');
            link.href = url;
            link.download = `SaleOrder_${saleOrder.SaleOrderNo}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('PDF download error:', error);
        toast.error('Failed to generate PDF');
    }
};
```

## Key Features Implemented

✅ **Professional PDF Configuration Modal** - Full layout customization
✅ **Mobile-First Control Fields** - Responsive touch-friendly controls
✅ **Live PDF Preview** - Real-time preview as you type
✅ **Collapsible Panels** - Layout controls and form can be hidden
✅ **Quick Layout Controls** - Sidebar with common adjustments
✅ **Reset Functionality** - Restore default layout
✅ **Download & Print** - Export configured PDFs

## Notes

1. **Data Mapping**: Adjust the data mapping in the PDF generation to match your SaleOrder/Invoice structure
2. **Type Safety**: Ensure the PDF type ('sale-order', 'invoice') is supported in pdfGenerator.ts
3. **Styling**: The components use the same professional styling as QuotationCreator
4. **Mobile Support**: All controls are mobile-first and touch-friendly

## Testing Checklist

- [ ] PDF preview updates when form data changes
- [ ] Layout controls adjust the PDF correctly
- [ ] Download generates proper PDF file
- [ ] Print function works correctly
- [ ] Mobile layout is responsive
- [ ] All panels can be toggled
- [ ] Reset button restores defaults
