import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
    // Exclude browser-only packages from server-side bundling
    serverExternalPackages: [
        '@fortune-sheet/react',
        '@fortune-sheet/core',
        'luckyexcel',
        'exceljs',
        '@corbe30/fortune-excel',
    ],
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin-allow-popups',
                    },
                ],
            },
        ];
    },
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
    outputFileTracingRoot: path.resolve('.'),
};

export default nextConfig;
