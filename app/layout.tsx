import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import AppProviders from '@/components/providers/AppProviders';
import AppShell from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui/sonner';
import SecurityModal from '@/components/modals/SecurityModal';

export const metadata: Metadata = {
    title: 'Limperial Project Dashboard',
    description: 'Internal project management, CRM and sales dashboard for Limperial.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://rsms.me/" crossOrigin="anonymous" />
                <link rel="preload" href="https://rsms.me/inter/inter.css" as="style" />
                <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
                <script src="https://accounts.google.com/gsi/client" async defer />
            </head>
            <body className="bg-background text-foreground antialiased">
                {/* Suspense required for useSearchParams used inside NavigationProvider */}
                <Suspense>
                    <AppProviders>
                        <AppShell>
                            {children}
                        </AppShell>
                        <SecurityModal />
                        <Toaster />
                    </AppProviders>
                </Suspense>
            </body>
        </html>
    );
}
