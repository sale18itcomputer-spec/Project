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

async function inspect(tableName) {
    const { data, error } = await supabase.from(tableName).select('*').limit(1);
    if (error) {
        console.error(`Error selecting from ${tableName}:`, error);
        return;
    }
    console.log(`\nColumns in ${tableName}:`);
    if (data && data.length > 0) {
        console.log(Object.keys(data[0]));
    } else {
        console.log('(No rows, performing dummy insert)');
        const { data: dummyData, error: dummyError } = await supabase.from(tableName).insert([{}]).select();
        if (dummyError) {
            console.error(`Dummy insert error on ${tableName}:`, dummyError);
        } else if (dummyData && dummyData.length > 0) {
            console.log(Object.keys(dummyData[0]));
        }
    }
}

async function run() {
    await inspect('quotations');
    await inspect('b2b_quotations');
    await inspect('sale_orders');
    await inspect('invoices');
}

run().catch(console.error);
