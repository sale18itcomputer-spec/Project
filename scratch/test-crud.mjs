import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env.local env variables manually
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

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key (truncated):', supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'undefined');

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTable(tableName, primaryKeyName, testPayload, updatePayload) {
    console.log(`\n--- Testing Table: ${tableName} ---`);
    
    // 1. INSERT
    console.log(`Inserting test record into ${tableName}...`);
    const { data: insertData, error: insertError } = await supabase
        .from(tableName)
        .insert([testPayload])
        .select();
        
    if (insertError) {
        console.error(`❌ INSERT ERROR on ${tableName}:`, insertError);
        return;
    }
    console.log(`✅ INSERT SUCCESS:`, insertData);
    
    // 2. UPDATE
    console.log(`Updating test record in ${tableName}...`);
    const pkValue = testPayload[primaryKeyName];
    const { data: updateData, error: updateError } = await supabase
        .from(tableName)
        .update(updatePayload)
        .eq(primaryKeyName, pkValue)
        .select();
        
    if (updateError) {
        console.error(`❌ UPDATE ERROR on ${tableName}:`, updateError);
    } else {
        console.log(`✅ UPDATE SUCCESS:`, updateData);
    }
    
    // 3. DELETE
    console.log(`Deleting test record from ${tableName}...`);
    const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq(primaryKeyName, pkValue);
        
    if (deleteError) {
        console.error(`❌ DELETE ERROR on ${tableName}:`, deleteError);
    } else {
        console.log(`✅ DELETE SUCCESS`);
    }
}

async function run() {
    // Test B2C pipelines table
    await testTable(
        'pipelines', 
        'Pipeline No', 
        { 
            'Pipeline No': 'TEST-B2C-PL-999', 
            'Company Name': 'Test Company', 
            'Require': 'Test requirements',
            'Status': 'Qualification',
            'Type': 'Project',
            'Taxable': 'VAT',
            'Currency': 'USD'
        },
        { 'Require': 'Updated test requirements' }
    );

    // Test B2C companies table
    await testTable(
        'companies',
        'Company ID',
        {
            'Company ID': 'TEST-B2C-COM-999',
            'Company Name': 'Test Company B2C',
            'Field': 'IT'
        },
        { 'Field': 'Fintech' }
    );

    // Test B2B pipelines table
    await testTable(
        'b2b_pipelines', 
        'Pipeline No', 
        { 
            'Pipeline No': 'TEST-B2B-PL-999', 
            'Company Name': 'Test Company B2B', 
            'Require': 'Test requirements B2B',
            'Status': 'Qualification',
            'Type': 'Project',
            'Taxable': 'VAT',
            'Currency': 'USD'
        },
        { 'Require': 'Updated B2B test requirements' }
    );

    // Test B2B companies table
    await testTable(
        'b2b_companies',
        'Company ID',
        {
            'Company ID': 'TEST-B2B-COM-999',
            'Company Name': 'Test Company B2B',
            'Field': 'IT'
        },
        { 'Field': 'Fintech' }
    );
}

run().catch(console.error);
