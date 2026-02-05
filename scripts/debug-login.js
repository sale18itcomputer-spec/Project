
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

async function debugUser() {
    console.log('Fetching users...');
    const { data: users, error } = await supabase
        .from('users')
        .select('*');

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    console.log('Found users:', users.length);
    if (users.length > 0) {
        const user = users[0];
        console.log('User Record Structure (Keys):', Object.keys(user));
        console.log('First User Data:', JSON.stringify(user, null, 2));

        const email = 'sale18itcomputer@gmail.com';
        const found = users.find(u => u.Email === email || u.email === email);
        console.log('Searching for target email:', JSON.stringify(found, null, 2));
    }
}

debugUser();
