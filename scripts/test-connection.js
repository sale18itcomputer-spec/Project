
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
console.log('Reading .env from:', envPath);

const envConfig = {};

if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    console.log('File content length:', envFile.length);

    const lines = envFile.split(/\r?\n/);
    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) return;

        const separatorIndex = trimmedLine.indexOf('=');
        if (separatorIndex > 0) {
            const key = trimmedLine.substring(0, separatorIndex).trim();
            const value = trimmedLine.substring(separatorIndex + 1).trim();
            envConfig[key] = value;
            console.log(`Found key: ${key}`);
        }
    });
} else {
    console.error('.env file not found!');
}

const supabaseUrl = envConfig['VITE_SUPABASE_URL'];
const supabaseKey = envConfig['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not found in map.');
    console.log('Available keys:', Object.keys(envConfig));
    process.exit(1);
}

console.log('Initializing Supabase client...');
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConnection() {
    console.log('Testing connection to Supabase...');
    console.log(`URL: ${supabaseUrl}`);

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Connection failed!');
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error details:', error.details);
        console.error('Hint:', error.hint);
    } else {
        console.log('Connection successful!');
        console.log('Data sample:', data);
    }
}

checkConnection();
