import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Allow images from external hosts used in the app
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'i.imgur.com',
            },
            {
                protocol: 'https',
                hostname: '*.supabase.co',
            },
        ],
    },
};

export default nextConfig;
