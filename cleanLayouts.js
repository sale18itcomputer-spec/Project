const fs = require('fs');
const path = require('path');

const files = [
  'components/features/sales/QuotationCreator.tsx',
  'components/features/sales/SaleOrderCreator.tsx',
  'components/features/sales/PurchaseOrderCreator.tsx',
  'components/features/sales/InvoiceCreator.tsx',
  'components/features/b2b/InvoiceCreator.tsx'
];

files.forEach(relativePath => {
  const filePath = path.join(__dirname, relativePath);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Remove imports
  content = content.replace(/import\s*\{\s*PDFLayoutConfig\s*,\s*defaultLayoutConfig\s*\}\s*from\s*['"]\.\.\/\.\.\/pdf\/pdfGenerator['"];?\r?\n?/g, '');
  content = content.replace(/import\s*PDFControlField\s*from\s*['"]\.\.\/\.\.\/pdf\/PDFControlField['"];?\r?\n?/g, '');
  content = content.replace(/import\s*PDFConfigModal\s*from\s*['"]\.\.\/\.\.\/modals\/PDFConfigModal['"];?\r?\n?/g, '');
  content = content.replace(/import\s*InvoicePDFControls\s*from\s*['"]\.\/InvoicePDFControls['"];?\r?\n?/g, '');

  // 2. Remove states
  content = content.replace(/const\s+\[pdfLayout,\s*setPdfLayout\]\s*=\s*useState<PDFLayoutConfig>\(defaultLayoutConfig\);\r?\n?/g, '');
  content = content.replace(/const\s+\[showPdfControls,\s*setShowPdfControls\]\s*=\s*useState\(false\);\r?\n?/g, '');
  content = content.replace(/const\s+\[showPdfConfig,\s*setShowPdfConfig\]\s*=\s*useState\(false\);\r?\n?/g, '');
  content = content.replace(/const\s+\[activeTab,\s*setActiveTab\]\s*=\s*useState<'header'\s*\|\s*'table'\s*\|\s*'footer'>\('header'\);\r?\n?/g, '');
  content = content.replace(/const\s+\[hoveredPath,\s*setHoveredPath\]\s*=\s*useState<string\s*\|\s*null>\(null\);\r?\n?/g, '');

  // 3. Remove functions
  // updateLayout
  content = content.replace(/\s*const\s+updateLayout\s*=\s*\(path:\s*string,\s*value:\s*any\)\s*=>\s*\{[\s\S]*?(?=\s*(const\s+handleItemChange|const\s+loadGlobalLayout|const\s+totals|const\s+handleSaveLayout))/g, (match) => {
      // Find the closing brace of the function to be precise
      // We know it ends with `};` or `}`.
      return ''; 
  });
  // handleSaveLayout
  content = content.replace(/\s*const\s+handleSaveLayout\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?(?=\s*(const\s+handleHeaderChange|const\s+handleCompanySelect|const\s+handleContactChange))/g, '');

  // loadGlobalLayout and useEffect
  content = content.replace(/\s*useEffect\(\(\)\s*=>\s*\{\s*const\s+loadGlobalLayout\s*=\s*async\s*\(\)\s*=>\s*\{[\s\S]*?loadGlobalLayout\(\);\s*\},\s*\[\]\);\r?\n?/g, '');

  // 4. Remove Layout button from JSX
  content = content.replace(/<button\s+onClick=\{\(\)\s*=>\s*setShowPdfControls\(!showPdfControls\)\}[\s\S]*?<SlidersHorizontal[\s\S]*?<\/button>\s*/g, '');
  content = content.replace(/<button\s+onClick=\{\(\)\s*=>\s*setShowLayoutControls\(!showLayoutControls\)\}[\s\S]*?<SlidersHorizontal[\s\S]*?<\/button>\s*/g, '');

  // 5. Remove the entire PDF controls panel
  // We'll use a trick: match from `{/* Layout Controls */}` to `{/* PDF Preview */}` or similar.
  content = content.replace(/\{\/\*\s*Layout Controls\s*\*\/\}([\s\S]*?)\{\/\*\s*PDF Preview\s*\*\/\}/g, '{/* PDF Preview */}');

  // 6. Remove <PDFConfigModal ... />
  content = content.replace(/<PDFConfigModal[\s\S]*?\/>\r?\n?/g, '');

  // 7. Remove InvoicePDFControls
  content = content.replace(/<InvoicePDFControls[\s\S]*?\/>\r?\n?/g, '');

  // Write changes back
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Cleaned ${filePath}`);
});
