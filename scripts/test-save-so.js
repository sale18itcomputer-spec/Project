
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUpsert() {
    const testData = {
        'SO No.': 'TEST-SO-001',
        'SO Date': new Date().toISOString(),
        'Company Name': 'Test Company',
        'Tax': '0',
        'Total Amount': '100',
        'Commission': '0',
        'Status': 'Pending',
        'Currency': 'USD',
        'ItemsJSON': JSON.stringify([{ itemCode: '1', qty: 1, unitPrice: 100, amount: 100 }])
    };

    console.log('Attempting upsert with:', testData);

    const { data, error } = await supabase
        .from('sale_orders')
        .upsert(testData, { onConflict: '"SO No."' })
        .select();

    if (error) {
        console.error('Upsert Error:', error);
    } else {
        console.log('Upsert Success:', data);
    }
}

testUpsert();
