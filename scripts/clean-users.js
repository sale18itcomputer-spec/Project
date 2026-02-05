
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env
const envPath = path.resolve(process.cwd(), '.env');
const envConfig = {};
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) envConfig[match[1].trim()] = match[2].trim();
    });
}

const supabase = createClient(envConfig['VITE_SUPABASE_URL'], envConfig['VITE_SUPABASE_ANON_KEY']);

async function checkDuplicates() {
    const email = 'sale18itcomputer@gmail.com';
    console.log(`Checking for duplicates of ${email}...`);

    const { data, error } = await supabase
        .from('users')
        .select('UserID, Email, Password, Status')
        .eq('Email', email);

    if (error) {
        console.error(error);
        return;
    }

    console.log('Records found:', data.length);
    console.log(data);

    if (data.length > 1) {
        console.log('Duplicates found! Deleting extra accounts...');
        // Keep the one with Password '123' or the latest one
        const toKeep = data.find(u => u.Password === '123') || data[0];
        const toDelete = data.filter(u => u.UserID !== toKeep.UserID).map(u => u.UserID);

        console.log('Keeping:', toKeep.UserID);
        console.log('Deleting:', toDelete);

        if (toDelete.length > 0) {
            const { error: delError } = await supabase
                .from('users')
                .delete()
                .in('UserID', toDelete);

            if (delError) console.error('Delete failed:', delError);
            else console.log('Duplicates deleted.');
        }
    }
}

checkDuplicates();
