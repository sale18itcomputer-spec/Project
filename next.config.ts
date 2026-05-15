import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
    outputFileTracingRoot: path.resolve(__dirname),
    // Allow cross-origin requests from cloudflared tunnel in dev
    allowedDevOrigins: ['*.trycloudflare.com'],
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
                    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-XSS-Protection', value: '1; mode=block' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload',
                    },
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://fonts.googleapis.com https://telegram.org",
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://rsms.me",
                            "font-src 'self' https://fonts.gstatic.com https://rsms.me data:",
                            "img-src 'self' data: blob: https: http:",
                            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://production-sfo.browserless.io",
                            "frame-src 'self' blob: data: https://telegram.org",
                            "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
                            "base-uri 'self'",
                            "form-action 'self'",
                        ].join('; '),
                    },
                ],
            },
            {
                // Mini app routes — relaxed CSP for Telegram embedding
                source: '/miniapp/:path*',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org",
                            "style-src 'self' 'unsafe-inline' https://rsms.me",
                            "font-src 'self' https://rsms.me data:",
                            "img-src 'self' data: blob: https: http:",
                            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://production-sfo.browserless.io",
                            "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
                        ].join('; '),
                    },
                    { key: 'X-Frame-Options', value: 'ALLOWALL' },
                ],
            },
            {
                source: '/api/(.*)',
                headers: [
                    { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
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
};

export default nextConfig;
