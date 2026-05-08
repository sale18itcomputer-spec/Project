const fs = require('fs');
const path = require('path');

const creatorPath = path.join(__dirname, '../components/features/sales/invoice/InvoiceCreator.tsx');

if (fs.existsSync(creatorPath)) {
    let content = fs.readFileSync(creatorPath, 'utf8');
    
    // Replace standard imports
    content = content.replace(/from "\.\.\/\.\.\//g, 'from "../../../');
    content = content.replace(/from "\.\.\/common/g, 'from "../../common');
    content = content.replace(/from "\.\.\/pdf/g, 'from "../../pdf');
    content = content.replace(/from "\.\.\/modals/g, 'from "../../modals');
    content = content.replace(/from "\.\.\/layout/g, 'from "../../layout');
    content = content.replace(/from "\.\.\/ui/g, 'from "../../ui');
    
    // Also type errors: companyOptions: string[], soOptions: string[]
    // The type error is because the type was inferred as string[] but the useMemo returns (string | undefined)[] or something.
    content = content.replace(/const companyOptions = useMemo\(\(\) => companies \? \[\.\.\.new Set\(companies\.map\(c => c\['Company Name'\]\)\.filter\(Boolean\)\)\]\.sort\(\) : \[\], \[companies\]\);/g, "const companyOptions = useMemo(() => companies ? [...new Set(companies.map(c => c['Company Name']).filter(Boolean))].sort() as string[] : [], [companies]);");
    content = content.replace(/const soOptions = useMemo\(\(\) => saleOrders \? \[\.\.\.new Set\(saleOrders\.map\(s => s\['SO No'\]\)\.filter\(Boolean\)\)\]\.sort\(\)\.reverse\(\) : \[\], \[saleOrders\]\);/g, "const soOptions = useMemo(() => saleOrders ? [...new Set(saleOrders.map(s => s['SO No']).filter(Boolean))].sort().reverse() as string[] : [], [saleOrders]);");
    
    fs.writeFileSync(creatorPath, content);
}

console.log("Imports and types fixed.");
