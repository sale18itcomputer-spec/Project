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

async function testRead() {
    const quoteNo = 'Q-0000081';
    
    console.time('read_quotation');
    console.log('Reading quotation:', quoteNo);
    
    const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .eq('Quote No', quoteNo)
        .single();

    console.timeEnd('read_quotation');
    
    if (error) {
        console.error('❌ Read failed:', error);
    } else {
        console.log('✅ Read succeeded');
        console.log('  ItemsJSON length:', data?.ItemsJSON ? data.ItemsJSON.length : 0);
        console.log('  Columns:', Object.keys(data));
    }
    
    // Also test how long a generic list fetch takes
    console.time('list_quotations');
    const { data: listData, error: listError } = await supabase
        .from('quotations')
        .select('*', { count: 'estimated' })
        .order('Quote No', { ascending: false })
        .range(0, 999);
    console.timeEnd('list_quotations');
    
    if (listError) {
        console.error('❌ List failed:', listError);
    } else {
        console.log('✅ List succeeded, count:', listData?.length);
    }
}

testRead().catch(console.error);
