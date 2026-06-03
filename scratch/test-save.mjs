import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
        }
        env[match[1]] = value;
    }
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function testSave() {
    const quoteNo = 'Q-0000081'; // The one from the screenshot
    const masterSheetData = {
        'Quote No': quoteNo,
        'File': '',
        'Quote Date': '2026-05-28',
        'Validity Date': '2026-05-28',
        'Company Name': 'Grant Thornton (Cambodia) Limited',
        'Company Address': 'Canadia Tower, 20th Floor, 315, Street Preah Ang Duong St. (110), Phnom Penh.',
        'Contact Name': 'Mr. Keo Savin',
        'Contact Number': '(+855) 15 645 063',
        'Contact Email': '',
        'Amount': 100,
        'CM': '10',
        'Status': 'Open',
        'Reason': '',
        'Payment Term': '',
        'Stock Status': '',
        'Created By': 'Test Agent',
        'Currency': 'USD',
        'Prepared By': 'Test Agent',
        'Prepared By Position': '',
        'Approved By': '',
        'Approved By Position': '',
        'Remark': '',
        'Terms and Conditions': '',
        'Tax Type': 'VAT',
        'ItemsJSON': JSON.stringify([{ id: '1', no: 1, itemCode: 'ITEM-1', modelName: 'Model 1', description: 'Desc 1', qty: 1, unitPrice: 100, amount: 100, commission: 10 }]),
        'updated_at': new Date().toISOString()
    };

    console.log('Testing upsert to quotations table for Quote No:', quoteNo);
    const { data, error } = await supabase
        .from('quotations')
        .upsert(masterSheetData, { onConflict: 'Quote No' })
        .select();

    if (error) {
        console.error('❌ Upsert failed with error:', error);
    } else {
        console.log('✅ Upsert succeeded:', data);
    }
}

testSave().catch(console.error);
