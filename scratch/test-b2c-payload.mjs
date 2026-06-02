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
        'Pipeline No': 'TEST-FULL-B2C-PL-999',
        'Company Name': 'Test Company B2C',
        'Contact Name': 'John Doe',
        'Require': 'Some B2C requirements',
        'Type': 'Project',
        'Taxable': 'VAT',
        'Status': 'Qualification',
        'Currency': 'USD',
        'Quote No': 'Q-12345-B2C',
        'SO No': 'SO-12345-B2C',
        'Invoice No': 'INV-12345-B2C'
    };

    console.log('Inserting full B2C payload into pipelines table...');
    const { data, error } = await supabase
        .from('pipelines')
        .insert([fullPayload])
        .select();

    if (error) {
        console.error('❌ B2C Insert failed with error:', error);
    } else {
        console.log('✅ B2C Insert succeeded:', data);
        
        // Let's test UPDATE on this record
        console.log('Updating test record in B2C pipelines...');
        const { data: updateData, error: updateError } = await supabase
            .from('pipelines')
            .update({ 'Require': 'Updated B2C requirements' })
            .eq('Pipeline No', 'TEST-FULL-B2C-PL-999')
            .select();
            
        if (updateError) {
            console.error('❌ B2C Update failed with error:', updateError);
        } else {
            console.log('✅ B2C Update succeeded:', updateData);
        }
        
        // Clean up
        console.log('Deleting test record from B2C pipelines...');
        const { error: deleteError } = await supabase
            .from('pipelines')
            .delete()
            .eq('Pipeline No', 'TEST-FULL-B2C-PL-999');
            
        if (deleteError) {
            console.error('❌ B2C Delete failed with error:', deleteError);
        } else {
            console.log('✅ B2C Delete succeeded!');
        }
    }
}

run().catch(console.error);
