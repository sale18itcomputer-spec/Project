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

async function run() {
    const fullPayload = {
        'Pipeline No': 'TEST-FULL-PL-999',
        'Company Name': 'Test Company B2B',
        'Contact Name': 'John Doe',
        'Require': 'Some requirements',
        'Type': 'Project',
        'Taxable': 'VAT',
        'Status': 'Qualification',
        'Currency': 'USD',
        'Quote No': 'Q-12345',
        'SO No': 'SO-12345',
        'Invoice No': 'INV-12345'
    };

    console.log('Inserting full B2B payload into b2b_pipelines...');
    const { data, error } = await supabase
        .from('b2b_pipelines')
        .insert([fullPayload])
        .select();

    if (error) {
        console.error('❌ Insert failed with error:', error);
    } else {
        console.log('✅ Insert succeeded:', data);
        // Clean up
        await supabase.from('b2b_pipelines').delete().eq('Pipeline No', 'TEST-FULL-PL-999');
    }
}

run().catch(console.error);
