const fs = require('fs');
const path = require('path');

const destDir = path.join(__dirname, '../components/features/sales/invoice');

// 1. Fix InvoicePreview.tsx
const previewPath = path.join(destDir, 'InvoicePreview.tsx');
if (fs.existsSync(previewPath)) {
    let content = fs.readFileSync(previewPath, 'utf8');
    content = content.replace(/<\/div>\s*<\/div>\s*\);\s*};/g, '</div>\n    );\n};');
    fs.writeFileSync(previewPath, content);
}

// 2. Fix InvoiceCreator.tsx
const creatorPath = path.join(destDir, 'InvoiceCreator.tsx');
if (fs.existsSync(creatorPath)) {
    let content = fs.readFileSync(creatorPath, 'utf8');
    content = content.replace(/<InvoicePreview([^>]+)\/>\n\s*\{\/\* Right Panel: Form Sidebar \*\/\}/g, '<InvoicePreview$1/>\n                    </div>\n\n                    {/* Right Panel: Form Sidebar */}');
    fs.writeFileSync(creatorPath, content);
}

console.log("Fixes applied.");
