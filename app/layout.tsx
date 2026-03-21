import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import AppProviders from '@/components/providers/AppProviders';
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
        <html lang="en" suppressHydrationWarning>
            <head>
                {/* Prevent flash of wrong theme — runs before React hydrates */}
                <script dangerouslySetInnerHTML={{ __html: `
(function(){
  try {
    var saved = localStorage.getItem('limperial-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e){}
})();
                `}} />
                <link rel="preconnect" href="https://rsms.me/" crossOrigin="anonymous" />
                <link rel="preload" href="https://rsms.me/inter/inter.css" as="style" />
                <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
            </head>
            <body className="bg-background text-foreground antialiased h-full overflow-hidden">
                {/* Suspense required for useSearchParams used inside NavigationProvider */}
                <Suspense fallback={null}>
                    <AppProviders>
                        {children}
                        <SecurityModal />
                        <Toaster />
                    </AppProviders>
                </Suspense>
            </body>
        </html>
    );
}
